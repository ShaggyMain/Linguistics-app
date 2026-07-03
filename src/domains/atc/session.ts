/**
 * ATC session generator — a small live-traffic simulation.
 *
 * The session keeps ~5 active aircraft (mix of departures and arrivals),
 * each walking a realistic flight-phase arc on ONE consistent airport
 * (scenario). Every `next()`:
 *
 *   1. picks an aircraft (never the same callsign twice in a row),
 *   2. builds a transmission valid for its current phase — either a
 *      full phraseology template or a combined multi-clause clearance,
 *   3. rejects candidates whose signature appeared in the rolling
 *      anti-repeat window (in-memory + persisted across sessions),
 *   4. advances the aircraft's phase and evolves the weather.
 *
 * Multi-transmission event arcs (go-around → climb-out → re-approach,
 * PAN PAN priority handling) unfold across several calls with other
 * traffic naturally interleaved — like a real frequency.
 */

import { Rng } from '../../core/random';
import {
  DEFAULT_DOMAIN_SETTINGS,
  DomainSettings,
  LevelId,
  Session,
  SessionOptions,
  SignatureHistory,
  Transmission,
} from '../types';
import { AircraftState, spawnAircraft } from './aircraft';
import { ATC_LEVEL_CONFIGS, AtcLevelConfig, levelAtLeast } from './levels';
import { FlightKind, isTerminal, Phase } from './phases';
import type { WakeCategory } from './pools';
import type { ReadoutMode } from './readout';
import { Scenario } from './scenario';
import {
  AtcCategory,
  BuildCtx,
  Built,
  CLAUSE_CLIMB,
  CLAUSE_DESCEND,
  CLAUSE_DIRECT,
  CLAUSE_EXPEDITE,
  CLAUSE_QNH,
  CLAUSE_SPEED,
  CLAUSE_SQUAWK,
  CLAUSE_TURN,
  ClauseSpec,
  composeClauses,
  FULL_INTENTS,
  makeContactClause,
} from './templates';

const FLEET_SIZE = 5;
const SIGNATURE_WINDOW = 50;
const EMERGENCY_COOLDOWN = 40;

const CONTACT_APPROACH = makeContactClause('approach');
const CONTACT_DEPARTURE = makeContactClause('departure');

interface Plan {
  built: Built;
  templateKey: string;
  category: AtcCategory;
  advanceTo: Phase | null;
  role: 'controller' | 'broadcast';
  slots: string[];
  effects?: () => void;
}

interface IntentChoice {
  weight: number;
  gen: () => Plan | null;
  category: AtcCategory;
}

export class AtcSession implements Session {
  private readonly rng: Rng;
  private readonly cfg: AtcLevelConfig;
  private readonly level: LevelId;
  private readonly settings: DomainSettings;
  private readonly mode: ReadoutMode;
  readonly scenario: Scenario;

  private fleet: AircraftState[] = [];
  private queue: Transmission[] = [];

  private readonly external?: SignatureHistory;
  private sigRing: string[] = [];
  private sigSet = new Set<string>();
  private textRing: string[] = [];

  private lastCallsign: string | null = null;
  private lastTemplateKey: string | null = null;
  private categoryCounts: Record<string, number> = {};
  private recentNumbers = new Set<number>();
  private recentTelephony: string[] = [];
  private runwayWake = new Map<string, WakeCategory>();
  private txnCount = 0;
  private lastEmergencyTxn = -EMERGENCY_COOLDOWN;
  private hasActiveEmergency = false;

  constructor(opts: SessionOptions) {
    this.rng = new Rng(opts.seed);
    this.level = opts.level;
    this.cfg = ATC_LEVEL_CONFIGS[opts.level];
    this.settings = { ...DEFAULT_DOMAIN_SETTINGS, ...opts.settings };
    this.mode =
      this.settings.numberReadout === 'auto'
        ? this.cfg.defaultReadout
        : this.settings.numberReadout;
    this.scenario = new Scenario(this.rng);
    this.external = opts.history;
    this.ensureFleet();
  }

  info(): { title: string; subtitle?: string } {
    const sc = this.scenario;
    const rwys = sc.activeRunways.join(' / ');
    const pressure =
      sc.airport.pressureUnit === 'hPa'
        ? `QNH ${sc.qnh}`
        : `ALT ${sc.qnh.toFixed(2)}`;
    return {
      title: `${sc.airport.name} · ${sc.airport.icao}`,
      subtitle: `RWY ${rwys} · ATIS ${sc.atis.charAt(0)} · ${pressure}`,
    };
  }

  /* ------------------------------ fleet ------------------------------ */

  private spawnKind(): FlightKind {
    const depShare = this.settings.facilityBias === 'approachCenter' ? 0.3 : 0.5;
    const deps = this.fleet.filter((a) => a.kind === 'departure').length;
    const arrs = this.fleet.length - deps;
    // Keep at least one of each in the mix.
    if (deps === 0) return 'departure';
    if (arrs === 0) return 'arrival';
    return this.rng.chance(depShare) ? 'departure' : 'arrival';
  }

  private entryPhase(kind: FlightKind): Phase {
    const towerBias = this.settings.facilityBias === 'towerGround';
    if (kind === 'departure') {
      const parkedShare = towerBias ? 0.8 : 0.45;
      return this.rng.chance(parkedShare) ? 'PARKED' : 'HOLD_SHORT';
    }
    if (!levelAtLeast(this.level, 'B2')) {
      return this.rng.chance(0.7) ? 'APPROACH' : 'FINAL';
    }
    const roll = this.rng.next();
    if (towerBias) {
      return roll < 0.35 ? 'DESCENT' : roll < 0.8 ? 'APPROACH' : 'FINAL';
    }
    return roll < 0.4 ? 'ENROUTE' : roll < 0.8 ? 'DESCENT' : 'APPROACH';
  }

  private ensureFleet(): void {
    while (this.fleet.length < FLEET_SIZE) {
      const kind = this.spawnKind();
      let emergency = false;
      if (
        kind === 'arrival' &&
        levelAtLeast(this.level, 'C1') &&
        !this.hasActiveEmergency &&
        this.txnCount - this.lastEmergencyTxn >= EMERGENCY_COOLDOWN &&
        this.rng.chance(this.cfg.emergencyProb)
      ) {
        emergency = true;
      }
      const ac = spawnAircraft(this.rng, this.scenario, this.level, this.mode, {
        kind,
        entryPhase: emergency ? 'DESCENT' : this.entryPhase(kind),
        emergency,
        usedTelephony: new Set([
          ...this.fleet.map((a) => a.telephony),
          ...this.recentTelephony,
        ]),
        recentNumbers: this.recentNumbers,
      });
      if (emergency) this.hasActiveEmergency = true;
      this.recentTelephony.push(ac.telephony);
      if (this.recentTelephony.length > 10) this.recentTelephony.shift();
      if (ac.flightNumber !== undefined) {
        this.recentNumbers.add(ac.flightNumber);
        if (this.recentNumbers.size > 15) {
          const first = this.recentNumbers.values().next().value as number;
          this.recentNumbers.delete(first);
        }
      }
      this.fleet.push(ac);
    }
  }

  private pickAircraft(): AircraftState {
    const candidates = this.fleet.filter(
      (a) => a.display !== this.lastCallsign || this.fleet.length === 1,
    );
    return this.rng.pickWeighted(candidates, (a) => {
      let w = 1;
      if (a.emergency && a.emergencyStage < 2) w *= 2.5;
      switch (a.phase) {
        case 'GO_AROUND':
          w *= 2.2;
          break;
        case 'FINAL':
          w *= 1.7;
          break;
        case 'TAKEOFF':
          w *= 1.6;
          break;
        case 'LINEUP':
          w *= 1.5;
          break;
        case 'HOLD_SHORT':
        case 'LANDED':
          w *= 1.3;
          break;
      }
      return w * (1 + 0.12 * a.idleTurns);
    });
  }

  /* --------------------------- plan building --------------------------- */

  private makeCtx(ac: AircraftState): BuildCtx {
    return {
      rng: this.rng,
      mode: this.mode,
      level: this.level,
      scenario: this.scenario,
      ac,
      slots: [],
    };
  }

  private fullPlan(
    intentId: keyof typeof FULL_INTENTS,
    ac: AircraftState,
    advanceTo: Phase | null,
    mutate?: (ctx: BuildCtx) => void,
    effects?: () => void,
  ): Plan | null {
    const intent = FULL_INTENTS[intentId];
    if (!levelAtLeast(this.level, intent.minLevel)) return null;
    const ctx = this.makeCtx(ac);
    mutate?.(ctx);
    const built = intent.build(ctx);
    return {
      built,
      templateKey: intent.id,
      category: intent.category,
      advanceTo,
      role: 'controller',
      slots: ctx.slots,
      effects,
    };
  }

  private comboPlan(
    ac: AircraftState,
    category: AtcCategory,
    pool: ClauseSpec[],
    opts: { mustInclude?: ClauseSpec; mustEnd?: ClauseSpec; advanceTo: Phase | null },
  ): Plan | null {
    const available = pool.filter(
      (c) => levelAtLeast(this.level, c.minLevel) && c !== opts.mustInclude,
    );
    const [lo, hi] = this.cfg.clauseRange;
    const reserved = (opts.mustEnd ? 1 : 0) + (opts.mustInclude ? 1 : 0);
    const extraCount = Math.max(
      reserved ? 0 : 1,
      Math.min(this.rng.int(lo, hi) - reserved, available.length),
    );

    const chosen: ClauseSpec[] = opts.mustInclude ? [opts.mustInclude] : [];
    const kinds = new Set<string>(chosen.map((c) => c.kind));
    if (opts.mustEnd) kinds.add(opts.mustEnd.kind);
    const shuffled = this.rng.shuffle(available);
    for (const spec of shuffled) {
      if (chosen.length >= extraCount + (opts.mustInclude ? 1 : 0)) break;
      if (kinds.has(spec.kind)) continue;
      kinds.add(spec.kind);
      chosen.push(spec);
    }
    if (chosen.length === 0 && !opts.mustEnd) return null;

    chosen.sort((a, b) => a.order - b.order);
    if (opts.mustEnd) chosen.push(opts.mustEnd);

    const ctx = this.makeCtx(ac);
    const built = composeClauses(
      ctx,
      chosen.map((c) => c.make(ctx)),
    );
    return {
      built,
      templateKey: `combo:${chosen.map((c) => c.kind).join('+')}`,
      category,
      advanceTo: opts.advanceTo,
      role: 'controller',
      slots: ctx.slots,
      effects: undefined,
    };
  }

  /** Arrival traffic ahead of `ac` (for sequencing / conditional line-up). */
  private trafficAhead(ac: AircraftState): { typeName: string; n: number; dist: number } | null {
    const ahead = this.fleet.find(
      (other) => other !== ac && other.kind === 'arrival' && other.phase === 'FINAL',
    );
    if (!ahead) return null;
    return { typeName: ahead.type.name, n: 2, dist: this.rng.int(3, 8) };
  }

  private wakeCautionFor(ac: AircraftState): boolean {
    if (!levelAtLeast(this.level, 'B2')) return false;
    const prev = this.runwayWake.get(ac.runway);
    return prev === 'H' || prev === 'J';
  }

  /**
   * True when another aircraft is lined up on / rolling down `ac`'s runway.
   * An aircraft holding a conditional line-up behind `ac` does not block it.
   */
  private runwayOccupied(ac: AircraftState): boolean {
    return this.fleet.some(
      (o) =>
        o !== ac &&
        o.runway === ac.runway &&
        (o.phase === 'LINEUP' || o.phase === 'TAKEOFF') &&
        o.waitingBehind !== ac.display,
    );
  }

  private choicesFor(ac: AircraftState): IntentChoice[] {
    const choices: IntentChoice[] = [];
    const add = (weight: number, category: AtcCategory, gen: () => Plan | null) =>
      choices.push({ weight, category, gen });

    // Emergency arc overrides the normal flow until resolved.
    if (ac.emergency && ac.emergencyStage === 0 && levelAtLeast(this.level, 'C1')) {
      add(6, 'nonnormal', () =>
        this.fullPlan('pan_ack', ac, 'FINAL', undefined, () => {
          ac.emergencyStage = 1;
          ac.towerContacted = true;
        }),
      );
      return choices;
    }

    switch (ac.phase) {
      case 'PARKED':
        add(2, 'ground', () => this.fullPlan('pushback', ac, 'PUSHBACK'));
        break;

      case 'PUSHBACK':
        add(2, 'ground', () => this.fullPlan('taxi_out', ac, 'TAXI_OUT'));
        break;

      case 'TAXI_OUT':
        add(2, 'tower', () => this.fullPlan('hold_short', ac, 'HOLD_SHORT'));
        add(0.6, 'ground', () => this.fullPlan('give_way', ac, null));
        break;

      case 'HOLD_SHORT': {
        const occupied = this.runwayOccupied(ac);
        if (!occupied) {
          const traffic = this.trafficAhead(ac);
          const sharedRunway = this.scenario.depRunway === this.scenario.arrRunway;
          if (traffic && sharedRunway && levelAtLeast(this.level, 'C2')) {
            const behind = this.fleet.find(
              (o) => o !== ac && o.kind === 'arrival' && o.phase === 'FINAL',
            );
            add(2.5, 'tower', () =>
              this.fullPlan(
                'lineup_conditional',
                ac,
                'LINEUP',
                (ctx) => {
                  ctx.traffic = traffic;
                },
                () => {
                  ac.waitingBehind = behind?.display;
                },
              ),
            );
          }
          add(2, 'tower', () => this.fullPlan('lineup', ac, 'LINEUP'));
          add(1.6, 'tower', () =>
            this.fullPlan('takeoff_clearance', ac, 'TAKEOFF', (ctx) => {
              ctx.wakeCaution = this.wakeCautionFor(ac);
            }),
          );
        }
        add(0.5, 'tower', () => this.fullPlan('hold_traffic', ac, null));
        add(0.3, 'tower', () => this.fullPlan('wind_check', ac, null));
        break;
      }

      case 'LINEUP':
        add(3, 'tower', () =>
          this.fullPlan('takeoff_clearance', ac, 'TAKEOFF', (ctx) => {
            ctx.wakeCaution = this.wakeCautionFor(ac);
          }),
        );
        add(0.3, 'tower', () => this.fullPlan('wind_check', ac, null));
        break;

      case 'TAKEOFF':
        add(3, 'tower', () =>
          this.comboPlan(ac, 'tower', [CLAUSE_CLIMB, CLAUSE_TURN], {
            mustEnd: CONTACT_DEPARTURE,
            advanceTo: 'DEPARTED',
          }),
        );
        break;

      case 'ENROUTE':
        add(2.2, 'enroute', () =>
          this.comboPlan(ac, 'enroute', [CLAUSE_SPEED, CLAUSE_DIRECT, CLAUSE_SQUAWK], {
            mustInclude: CLAUSE_DESCEND,
            advanceTo: 'DESCENT',
          }),
        );
        add(0.9, 'enroute', () =>
          this.comboPlan(ac, 'enroute', [CLAUSE_DIRECT, CLAUSE_SPEED, CLAUSE_SQUAWK], {
            advanceTo: null,
          }),
        );
        add(0.6, 'enroute', () => this.fullPlan('traffic_advisory', ac, null));
        break;

      case 'DESCENT': {
        // Realism guards: QNH is passed once; descents only while still high.
        const qnhPool = ac.qnhGiven ? [] : [CLAUSE_QNH];
        const descendPool = ac.lastAltFt === undefined || ac.lastAltFt > 7000 ? [CLAUSE_DESCEND] : [];
        add(1.8, 'enroute', () =>
          this.comboPlan(ac, 'enroute', [...descendPool, CLAUSE_SPEED, ...qnhPool, CLAUSE_EXPEDITE], {
            mustEnd: CONTACT_APPROACH,
            advanceTo: 'APPROACH',
          }),
        );
        add(1.4, 'enroute', () =>
          this.comboPlan(
            ac,
            'enroute',
            [...descendPool, CLAUSE_SPEED, CLAUSE_DIRECT, CLAUSE_SQUAWK, ...qnhPool, CLAUSE_EXPEDITE],
            { advanceTo: null },
          ),
        );
        add(0.5, 'enroute', () => this.fullPlan('traffic_advisory', ac, null));
        break;
      }

      case 'APPROACH': {
        add(2.2, 'approach', () => this.fullPlan('approach_clearance', ac, 'FINAL'));
        const qnhPool = ac.qnhGiven ? [] : [CLAUSE_QNH];
        const descendPool = ac.lastAltFt === undefined || ac.lastAltFt > 4000 ? [CLAUSE_DESCEND] : [];
        add(1.5, 'approach', () =>
          this.comboPlan(ac, 'approach', [CLAUSE_TURN, ...descendPool, CLAUSE_SPEED, ...qnhPool], {
            advanceTo: null,
          }),
        );
        const traffic = this.trafficAhead(ac);
        if (traffic) {
          add(1.1, 'approach', () =>
            this.fullPlan('sequencing', ac, null, (ctx) => {
              ctx.traffic = traffic;
            }),
          );
        }
        add(0.6, 'approach', () => this.fullPlan('traffic_advisory', ac, null));
        break;
      }

      case 'FINAL': {
        if (!ac.towerContacted) {
          add(4, 'approach', () =>
            this.fullPlan('contact_tower', ac, null, undefined, () => {
              ac.towerContacted = true;
            }),
          );
          break;
        }
        const occupied = this.runwayOccupied(ac);
        if (ac.emergency && ac.emergencyStage === 1) {
          if (occupied) {
            add(2, 'tower', () => this.fullPlan('continue_approach', ac, null));
            break;
          }
          add(5, 'nonnormal', () =>
            this.fullPlan('emergency_landing', ac, 'LANDED', undefined, () => {
              ac.emergencyStage = 2;
              this.hasActiveEmergency = false;
              this.lastEmergencyTxn = this.txnCount;
            }),
          );
          break;
        }
        // Go-around: occasionally at random, more likely when the runway
        // is still occupied by a departure (the realistic trigger).
        if (
          !ac.goAroundDone &&
          this.cfg.goAroundProb > 0 &&
          this.rng.chance(occupied ? 0.35 : this.cfg.goAroundProb)
        ) {
          add(10, 'tower', () =>
            this.fullPlan('go_around', ac, 'GO_AROUND', undefined, () => {
              ac.goAroundDone = true;
            }),
          );
          break;
        }
        if (occupied) {
          add(2, 'tower', () => this.fullPlan('continue_approach', ac, null));
          add(0.4, 'tower', () => this.fullPlan('wind_check', ac, null));
          break;
        }
        add(2.4, 'tower', () =>
          this.fullPlan('landing_clearance', ac, 'LANDED', (ctx) => {
            ctx.wakeCaution = this.wakeCautionFor(ac);
          }),
        );
        const traffic = this.trafficAhead(ac);
        if (traffic && this.rng.chance(0.5)) {
          add(0.8, 'approach', () =>
            this.fullPlan('sequencing', ac, null, (ctx) => {
              ctx.traffic = traffic;
            }),
          );
        }
        add(0.4, 'tower', () => this.fullPlan('wind_check', ac, null));
        break;
      }

      case 'GO_AROUND':
        add(4, 'approach', () =>
          this.fullPlan('goaround_climbout', ac, 'APPROACH', undefined, () => {
            ac.towerContacted = false;
          }),
        );
        break;

      case 'LANDED':
        add(2.5, 'ground', () => this.fullPlan('vacate', ac, 'GATE'));
        break;
    }

    return choices;
  }

  /** Boost intents whose category is under-represented so far. */
  private coverageBoost(category: AtcCategory): number {
    const expected = this.cfg.expectedCategories;
    if (!expected.includes(category)) return 1;
    let minCat: string | null = null;
    let minCount = Infinity;
    for (const cat of expected) {
      const count = this.categoryCounts[cat] ?? 0;
      if (count < minCount) {
        minCount = count;
        minCat = cat;
      }
    }
    return category === minCat ? 1.7 : 1;
  }

  /* ------------------------------- next() ------------------------------- */

  next(): Transmission {
    if (this.queue.length > 0) return this.queue.shift() as Transmission;
    this.ensureFleet();

    let fallback: { ac: AircraftState; plan: Plan; sig: string } | null = null;

    for (let attempt = 0; attempt < 48; attempt++) {
      const ac = this.pickAircraft();
      const choices = this.choicesFor(ac);
      if (choices.length === 0) continue;

      const choice = this.rng.pickWeighted(choices, (c) => c.weight * this.coverageBoost(c.category));
      const plan = choice.gen();
      if (!plan) continue;
      if (plan.templateKey === this.lastTemplateKey) continue;

      const sig = `${plan.templateKey}|${ac.display}|${plan.slots.join('|')}`;
      const repeated =
        this.sigSet.has(sig) ||
        this.external?.has(sig) === true ||
        this.textRing.includes(plan.built.text);

      if (repeated) {
        if (!fallback) fallback = { ac, plan, sig };
        continue;
      }
      return this.commit(ac, plan, sig);
    }

    // Extremely unlikely: everything in sight was a repeat. Emit the best
    // candidate anyway — never stall the teleprompter.
    if (fallback) return this.commit(fallback.ac, fallback.plan, fallback.sig);

    // Truly degenerate state: reset the anti-repeat window and retry once.
    this.sigRing = [];
    this.sigSet.clear();
    this.textRing = [];
    return this.next();
  }

  private commit(ac: AircraftState, plan: Plan, sig: string): Transmission {
    this.sigRing.push(sig);
    this.sigSet.add(sig);
    if (this.sigRing.length > SIGNATURE_WINDOW) {
      const evicted = this.sigRing.shift() as string;
      this.sigSet.delete(evicted);
    }
    this.external?.push(sig);
    this.textRing.push(plan.built.text);
    if (this.textRing.length > SIGNATURE_WINDOW) this.textRing.shift();

    this.lastCallsign = ac.display;
    this.lastTemplateKey = plan.templateKey;
    this.categoryCounts[plan.category] = (this.categoryCounts[plan.category] ?? 0) + 1;
    this.txnCount++;

    for (const other of this.fleet) other.idleTurns++;
    ac.idleTurns = 0;

    plan.effects?.();
    if (plan.advanceTo) ac.phase = plan.advanceTo;

    if (
      plan.templateKey === 'takeoff_clearance' ||
      plan.templateKey === 'landing_clearance' ||
      plan.templateKey === 'emergency_landing'
    ) {
      this.runwayWake.set(ac.runway, ac.type.wake);
    }

    // Once this arrival has landed, conditional line-ups behind it become
    // normal runway occupants again.
    if (plan.templateKey === 'landing_clearance' || plan.templateKey === 'emergency_landing') {
      for (const o of this.fleet) {
        if (o.waitingBehind === ac.display) o.waitingBehind = undefined;
      }
    }

    if (isTerminal(ac.phase)) {
      if (ac.emergency) this.hasActiveEmergency = false;
      this.fleet = this.fleet.filter((a) => a !== ac);
    }

    const atisRolled = this.scenario.evolve();
    if (atisRolled && levelAtLeast(this.level, 'C1')) {
      const ctx = this.makeCtx(ac);
      const built = FULL_INTENTS.atis_update.build(ctx);
      this.queue.push({
        text: built.text,
        meta: {
          templateKey: 'atis_update',
          category: 'tower',
          role: 'broadcast',
          instructions: built.instructions,
          signature: `atis_update|${ctx.slots.join('|')}`,
        },
      });
    }

    const txn: Transmission = {
      text: plan.built.text,
      meta: {
        templateKey: plan.templateKey,
        category: plan.category,
        callsign: ac.display,
        phase: ac.phase,
        role: plan.role,
        instructions: plan.built.instructions,
        signature: sig,
      },
    };

    if (this.settings.pilotReadbacks && plan.built.readback && plan.role === 'controller') {
      this.queue.unshift({
        text: plan.built.readback,
        meta: {
          templateKey: `${plan.templateKey}:readback`,
          category: plan.category,
          callsign: ac.display,
          role: 'pilot',
          instructions: 0,
        },
      });
    }

    return txn;
  }
}

export function createAtcSession(opts: SessionOptions): Session {
  return new AtcSession(opts);
}
