/**
 * ICAO-style phraseology bank.
 *
 * Two building blocks:
 *  - FULL intents: complete transmissions tied to a flight phase
 *    (taxi, line up, takeoff/landing clearance, go-around, PAN PAN…)
 *  - CLAUSES: instruction fragments (turn / climb / descend / speed /
 *    squawk / QNH / contact…) that the session combines into dense
 *    multi-instruction clearances at C1/C2, e.g.
 *    "United 88, turn left heading 310, descend and maintain 4000,
 *     contact Approach on 119.1."
 *
 * Every value slot is drawn from the live scenario (same airport, same
 * active runways, same per-facility frequencies for the whole session),
 * which is what makes the stream feel like one believable frequency.
 */

import { Rng } from '../../core/random';
import type { LevelId } from '../types';
import type { AircraftState } from './aircraft';
import { levelAtLeast } from './levels';
import { AIRCRAFT_TYPES, FIXES } from './pools';
import {
  formatAltitude,
  formatFlightLevel,
  formatFrequency,
  formatHeading,
  formatPressure,
  formatRunway,
  formatSpeed,
  formatSquawk,
  formatWind,
  ReadoutMode,
} from './readout';
import type { Scenario } from './scenario';

export type AtcCategory = 'ground' | 'tower' | 'approach' | 'enroute' | 'nonnormal';

export interface BuildCtx {
  rng: Rng;
  mode: ReadoutMode;
  level: LevelId;
  scenario: Scenario;
  ac: AircraftState;
  /** Key slot values collected while building — feeds the anti-repeat signature. */
  slots: string[];
  /** Wake category caution applies (preceding heavy/super on this runway). */
  wakeCaution?: boolean;
  /** Info about the arrival ahead, for sequencing / conditional line-up. */
  traffic?: { typeName: string; n: number; dist: number };
}

export interface Built {
  text: string;
  readback?: string;
  instructions: number;
}

export interface FullIntent {
  id: string;
  category: AtcCategory;
  minLevel: LevelId;
  build(ctx: BuildCtx): Built;
}

/* ---------- slot helpers (record every key value into ctx.slots) ---------- */

const cs = (ctx: BuildCtx) => ctx.ac.display;

function slot(ctx: BuildCtx, value: string): string {
  ctx.slots.push(value);
  return value;
}

function rwy(ctx: BuildCtx): string {
  return slot(ctx, formatRunway(ctx.ac.runway, ctx.mode));
}

/** "a Boeing 737" but "an Airbus A320" / "an Embraer 175". */
function withArticle(typeName: string): string {
  return `${/^[aeiou]/i.test(typeName) ? 'an' : 'a'} ${typeName}`;
}

function wind(ctx: BuildCtx): string {
  // Deliberately NOT a signature slot — wind drifts constantly anyway.
  return formatWind(ctx.scenario.wind, ctx.mode);
}

function heading(ctx: BuildCtx): string {
  return slot(ctx, formatHeading(ctx.rng.intStep(5, 360, 5), ctx.mode));
}

function taxiway(ctx: BuildCtx): string {
  return slot(ctx, ctx.rng.pick(ctx.scenario.airport.taxiways));
}

function twoTaxiways(ctx: BuildCtx): [string, string] {
  const shuffled = ctx.rng.shuffle(ctx.scenario.airport.taxiways);
  return [slot(ctx, shuffled[0]), slot(ctx, shuffled[1])];
}

function freqOf(ctx: BuildCtx, facility: keyof Scenario['freqs']): string {
  return slot(ctx, formatFrequency(ctx.scenario.freqs[facility], ctx.mode));
}

function pressure(ctx: BuildCtx): { label: string; value: string } {
  const unit = ctx.scenario.airport.pressureUnit;
  return {
    label: unit === 'hPa' ? 'QNH' : 'altimeter',
    value: slot(ctx, formatPressure(ctx.scenario.qnh, unit, ctx.mode)),
  };
}

function randomJetType(ctx: BuildCtx): string {
  return ctx.rng.pick(AIRCRAFT_TYPES.filter((t) => !t.ga)).name;
}

const wakePrefix = (ctx: BuildCtx) => (ctx.wakeCaution ? 'caution wake turbulence, ' : '');

/* ------------------------------ full intents ------------------------------ */

export const FULL_INTENTS: Record<string, FullIntent> = {
  pushback: {
    id: 'pushback',
    category: 'ground',
    minLevel: 'B1',
    build(ctx) {
      const variants = [
        `${cs(ctx)}, pushback approved.`,
        `${cs(ctx)}, push and start approved.`,
      ];
      if (levelAtLeast(ctx.level, 'B2')) {
        variants.push(`${cs(ctx)}, pushback approved, expect runway ${rwy(ctx)} for departure.`);
      }
      return {
        text: ctx.rng.pick(variants),
        readback: `Pushback approved, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  taxi_out: {
    id: 'taxi_out',
    category: 'ground',
    minLevel: 'B1',
    build(ctx) {
      const point = taxiway(ctx);
      const r = rwy(ctx);
      if (!levelAtLeast(ctx.level, 'B2')) {
        return {
          text: `${cs(ctx)}, taxi to holding point ${point} via ${taxiway(ctx)}, hold short of runway ${r}.`,
          readback: `Taxi holding point ${point}, hold short runway ${r}, ${cs(ctx)}.`,
          instructions: 2,
        };
      }
      const [t1, t2] = twoTaxiways(ctx);
      const variants = [
        `${cs(ctx)}, taxi to holding point ${point} runway ${r} via ${t1} and ${t2}, hold short of runway ${r}.`,
        `${cs(ctx)}, runway ${r}, taxi via ${t1} and ${t2}, hold short of runway ${r}.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Via ${t1} and ${t2}, holding short runway ${r}, ${cs(ctx)}.`,
        instructions: 2,
      };
    },
  },

  hold_short: {
    id: 'hold_short',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const variants = [
        `${cs(ctx)}, hold short of runway ${r}.`,
        `${cs(ctx)}, hold short of runway ${r}, landing traffic.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Holding short runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  give_way: {
    id: 'give_way',
    category: 'ground',
    minLevel: 'B2',
    build(ctx) {
      const type = randomJetType(ctx);
      ctx.slots.push(type);
      const variants = [
        `${cs(ctx)}, give way to the ${type} crossing left to right, then continue taxi.`,
        `${cs(ctx)}, hold position, ${type} crossing ahead.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Giving way to the ${type}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  hold_traffic: {
    id: 'hold_traffic',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      return {
        text: `${cs(ctx)}, continue holding short of runway ${r}, landing traffic.`,
        readback: `Holding short runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  lineup: {
    id: 'lineup',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const variants = [
        `${cs(ctx)}, runway ${r}, line up and wait.`,
        `${cs(ctx)}, line up and wait, runway ${r}.`,
      ];
      if (levelAtLeast(ctx.level, 'C1')) {
        variants.push(`${cs(ctx)}, runway ${r}, line up and wait, landing traffic on short final.`);
      }
      return {
        text: ctx.rng.pick(variants),
        readback: `Lining up runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  lineup_conditional: {
    id: 'lineup_conditional',
    category: 'tower',
    minLevel: 'C2',
    build(ctx) {
      const r = rwy(ctx);
      const type = ctx.traffic?.typeName ?? randomJetType(ctx);
      ctx.slots.push(type);
      return {
        text: `${cs(ctx)}, behind the landing ${type}, line up and wait runway ${r}, behind.`,
        readback: `Behind the landing ${type}, lining up runway ${r} behind, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  takeoff_clearance: {
    id: 'takeoff_clearance',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const w = wind(ctx);
      const caution = wakePrefix(ctx);
      const variants = [
        `${cs(ctx)}, ${caution}runway ${r}, cleared for takeoff, wind ${w}.`,
        `${cs(ctx)}, ${caution}wind ${w}, runway ${r}, cleared for takeoff.`,
      ];
      if (levelAtLeast(ctx.level, 'B2')) {
        variants.push(`${cs(ctx)}, ${caution}runway ${r}, cleared for immediate takeoff, wind ${w}.`);
      }
      return {
        text: ctx.rng.pick(variants),
        readback: `Cleared for takeoff runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  landing_clearance: {
    id: 'landing_clearance',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const w = wind(ctx);
      const caution = wakePrefix(ctx);
      const variants = [
        `${cs(ctx)}, ${caution}runway ${r}, cleared to land, wind ${w}.`,
        `${cs(ctx)}, ${caution}wind ${w}, runway ${r}, cleared to land.`,
      ];
      if (levelAtLeast(ctx.level, 'C1')) {
        variants.push(`${cs(ctx)}, ${caution}runway ${r}, cleared to land, surface wind ${w}.`);
      }
      return {
        text: ctx.rng.pick(variants),
        readback: `Cleared to land runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  contact_tower: {
    id: 'contact_tower',
    category: 'approach',
    minLevel: 'B1',
    build(ctx) {
      const f = freqOf(ctx, 'tower');
      const name = ctx.scenario.airport.tower;
      const variants = [
        `${cs(ctx)}, contact ${name} on ${f}.`,
        `${cs(ctx)}, contact ${name} ${f}, good day.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Over to ${name} ${f}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  approach_clearance: {
    id: 'approach_clearance',
    category: 'approach',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const kind = levelAtLeast(ctx.level, 'B2') && ctx.rng.chance(0.3) ? 'RNAV' : 'ILS';
      ctx.slots.push(kind);
      const variants: { text: string; instructions: number }[] = [
        {
          text: `${cs(ctx)}, cleared ${kind} approach runway ${r}, report established.`,
          instructions: 2,
        },
      ];
      if (levelAtLeast(ctx.level, 'B2')) {
        const alt = ctx.rng.intStep(3000, 5000, 1000);
        ctx.ac.lastAltFt = alt;
        variants.push({
          text: `${cs(ctx)}, descend to ${slot(ctx, formatAltitude(alt, ctx.mode))} feet, cleared ${kind} approach runway ${r}.`,
          instructions: 2,
        });
      }
      if (levelAtLeast(ctx.level, 'C1')) {
        const h = heading(ctx);
        const dir = ctx.rng.pick(['left', 'right'] as const);
        variants.push({
          text: `${cs(ctx)}, turn ${dir} heading ${h}, cleared ${kind} approach runway ${r}, report established on the localizer.`,
          instructions: 3,
        });
      }
      const v = ctx.rng.pick(variants);
      return {
        text: v.text,
        readback: `Cleared ${kind} approach runway ${r}, ${cs(ctx)}.`,
        instructions: v.instructions,
      };
    },
  },

  sequencing: {
    id: 'sequencing',
    category: 'approach',
    minLevel: 'C1',
    build(ctx) {
      const n = slot(ctx, String(ctx.traffic?.n ?? 2));
      const type = ctx.traffic?.typeName ?? randomJetType(ctx);
      ctx.slots.push(type);
      const dist = slot(ctx, String(ctx.traffic?.dist ?? ctx.rng.int(3, 8)));
      const variants = [
        `${cs(ctx)}, number ${n}, follow the ${type} on final.`,
        `${cs(ctx)}, you are number ${n}, traffic ahead is ${withArticle(type)} on a ${dist} mile final.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Number ${n}, following the ${type}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  traffic_advisory: {
    id: 'traffic_advisory',
    category: 'approach',
    minLevel: 'C1',
    build(ctx) {
      const oclock = slot(ctx, String(ctx.rng.pick([1, 2, 3, 9, 10, 11])));
      const dist = slot(ctx, String(ctx.rng.int(3, 9)));
      const type = randomJetType(ctx);
      ctx.slots.push(type);
      const cross = ctx.rng.pick([
        'crossing left to right',
        'crossing right to left',
        'opposite direction',
        'same direction',
      ]);
      const variants = [
        `${cs(ctx)}, traffic, ${oclock} o'clock, ${dist} miles, ${cross}, ${withArticle(type)}, report in sight.`,
        `${cs(ctx)}, traffic is ${withArticle(type)}, ${oclock} o'clock, ${dist} miles, report in sight.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Looking out for the ${type}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  continue_approach: {
    id: 'continue_approach',
    category: 'tower',
    minLevel: 'B1',
    build(ctx) {
      const r = rwy(ctx);
      const variants = [
        `${cs(ctx)}, continue approach, runway ${r}.`,
        `${cs(ctx)}, continue approach, expect late landing clearance.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Continuing approach, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  wind_check: {
    id: 'wind_check',
    category: 'tower',
    minLevel: 'B2',
    build(ctx) {
      return {
        text: `${cs(ctx)}, wind check, ${wind(ctx)}.`,
        readback: `Copied, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  go_around: {
    id: 'go_around',
    category: 'tower',
    minLevel: 'B2',
    build(ctx) {
      const variants = [
        `${cs(ctx)}, go around, I say again, go around, acknowledge.`,
      ];
      if (levelAtLeast(ctx.level, 'C1')) {
        variants.push(`${cs(ctx)}, go around, traffic on the runway, I say again, go around.`);
      }
      return {
        text: ctx.rng.pick(variants),
        readback: `Going around, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  goaround_climbout: {
    id: 'goaround_climbout',
    category: 'approach',
    minLevel: 'B2',
    build(ctx) {
      const alt = ctx.rng.intStep(3000, 4000, 1000);
      ctx.ac.lastAltFt = alt;
      const altText = slot(ctx, formatAltitude(alt, ctx.mode));
      const variants: { text: string; instructions: number }[] = [
        {
          text: `${cs(ctx)}, climb to ${altText} feet, fly runway heading, expect vectors for another approach.`,
          instructions: 2,
        },
      ];
      if (levelAtLeast(ctx.level, 'C1')) {
        const h = heading(ctx);
        const dir = ctx.rng.pick(['left', 'right'] as const);
        variants.push({
          text: `${cs(ctx)}, climb to ${altText} feet, turn ${dir} heading ${h}, vectors for re-sequencing.`,
          instructions: 3,
        });
      }
      const v = ctx.rng.pick(variants);
      return {
        text: v.text,
        readback: `Climbing ${altText} feet, ${cs(ctx)}.`,
        instructions: v.instructions,
      };
    },
  },

  vacate: {
    id: 'vacate',
    category: 'ground',
    minLevel: 'B1',
    build(ctx) {
      const dir = ctx.rng.pick(['left', 'right'] as const);
      const t = taxiway(ctx);
      const f = freqOf(ctx, 'ground');
      const ground = ctx.scenario.airport.ground;
      const variants: { text: string; instructions: number }[] = [
        {
          text: `${cs(ctx)}, vacate ${dir} via ${t}, contact ${ground} on ${f}.`,
          instructions: 2,
        },
      ];
      if (levelAtLeast(ctx.level, 'B2')) {
        variants.push({
          text: `${cs(ctx)}, turn ${dir} when able, taxi to the apron via ${t}, contact ${ground} ${f}.`,
          instructions: 3,
        });
      }
      if (ctx.ac.emergency && levelAtLeast(ctx.level, 'C1')) {
        variants.push({
          text: `${cs(ctx)}, when able vacate ${dir} via ${t}, emergency vehicles will follow you.`,
          instructions: 2,
        });
      }
      const v = ctx.rng.pick(variants);
      return {
        text: v.text,
        readback: `Vacating ${dir} via ${t}, ${cs(ctx)}.`,
        instructions: v.instructions,
      };
    },
  },

  pan_ack: {
    id: 'pan_ack',
    category: 'nonnormal',
    minLevel: 'C1',
    build(ctx) {
      const r = rwy(ctx);
      const variants: { text: string; instructions: number }[] = [
        {
          text: `${cs(ctx)}, roger your PAN PAN, cleared straight-in ILS approach runway ${r}, number 1, emergency services standing by.`,
          instructions: 2,
        },
        {
          text: `${cs(ctx)}, PAN PAN acknowledged, expect shortest vectors runway ${r}, you are number 1.`,
          instructions: 2,
        },
      ];
      const v = ctx.rng.pick(variants);
      return {
        text: v.text,
        readback: `Cleared straight-in runway ${r}, ${cs(ctx)}.`,
        instructions: v.instructions,
      };
    },
  },

  emergency_landing: {
    id: 'emergency_landing',
    category: 'nonnormal',
    minLevel: 'C1',
    build(ctx) {
      const r = rwy(ctx);
      const w = wind(ctx);
      const variants = [
        `${cs(ctx)}, runway ${r}, cleared to land, emergency services on standby, wind ${w}.`,
        `${cs(ctx)}, cleared to land runway ${r}, fire services alerted, wind ${w}.`,
      ];
      return {
        text: ctx.rng.pick(variants),
        readback: `Cleared to land runway ${r}, ${cs(ctx)}.`,
        instructions: 1,
      };
    },
  },

  atis_update: {
    id: 'atis_update',
    category: 'tower',
    minLevel: 'C1',
    build(ctx) {
      const p = pressure(ctx);
      const atis = slot(ctx, ctx.scenario.atis);
      return {
        text: `All stations, ${ctx.scenario.airport.name} information ${atis} now current, ${p.label} ${p.value}.`,
        instructions: 1,
      };
    },
  },
};

/* -------------------------------- clauses -------------------------------- */

export type ClauseKind =
  | 'turn'
  | 'direct'
  | 'level'
  | 'expedite'
  | 'speed'
  | 'squawk'
  | 'qnh'
  | 'contact';

export interface ClauseSpec {
  kind: ClauseKind;
  minLevel: LevelId;
  /** Canonical position within a combined clearance (ascending). */
  order: number;
  make(ctx: BuildCtx): { clause: string; readback?: string };
}

function makeSquawkCode(rng: Rng): string {
  const forbidden = new Set(['7500', '7600', '7700', '0000', '1200', '2000', '7000']);
  let code = '';
  do {
    code = `${rng.int(0, 7)}${rng.int(0, 7)}${rng.int(0, 7)}${rng.int(0, 7)}`;
  } while (forbidden.has(code));
  return code;
}

export const CLAUSE_TURN: ClauseSpec = {
  kind: 'turn',
  minLevel: 'B2',
  order: 1,
  make(ctx) {
    const h = heading(ctx);
    const variant = ctx.rng.pick(['turn left', 'turn right', 'fly'] as const);
    return {
      clause: variant === 'fly' ? `fly heading ${h}` : `${variant} heading ${h}`,
      readback: `heading ${h}`,
    };
  },
};

export const CLAUSE_DIRECT: ClauseSpec = {
  kind: 'direct',
  minLevel: 'B2',
  order: 2,
  make(ctx) {
    const fix = slot(ctx, ctx.rng.pick(FIXES));
    return { clause: `proceed direct ${fix}`, readback: `direct ${fix}` };
  },
};

export const CLAUSE_CLIMB: ClauseSpec = {
  kind: 'level',
  minLevel: 'B2',
  order: 3,
  make(ctx) {
    const alt = ctx.rng.intStep(4000, 6000, 1000);
    ctx.ac.lastAltFt = alt;
    const altText = slot(ctx, formatAltitude(alt, ctx.mode));
    const variants = [`climb and maintain ${altText}`, `climb to altitude ${altText} feet`];
    return { clause: ctx.rng.pick(variants), readback: `climbing ${altText}` };
  },
};

/** Descend clause with per-phase plausible targets, monotonically lower. */
export const CLAUSE_DESCEND: ClauseSpec = {
  kind: 'level',
  minLevel: 'B2',
  order: 3,
  make(ctx) {
    const phase = ctx.ac.phase;
    if (phase === 'ENROUTE') {
      const ceiling = Math.max(160, (ctx.ac.lastFl ?? 340) - 60);
      const fl = ctx.rng.intStep(160, Math.max(170, Math.min(240, ceiling)), 10);
      ctx.ac.lastFl = fl;
      const flText = slot(ctx, formatFlightLevel(fl, ctx.mode));
      const variants = [`descend flight level ${flText}`];
      if (levelAtLeast(ctx.level, 'C2')) {
        variants.push(`when ready, descend flight level ${flText}`);
      }
      return { clause: ctx.rng.pick(variants), readback: `descending flight level ${flText}` };
    }
    const [lo, hiBase] = phase === 'DESCENT' ? [6000, 10000] : [3000, 5000];
    // Strictly lower than the last assigned altitude — no yo-yo clearances.
    const hi = ctx.ac.lastAltFt ? Math.min(hiBase, ctx.ac.lastAltFt - 1000) : hiBase;
    const alt = hi <= lo ? lo : ctx.rng.intStep(lo, hi, 1000);
    ctx.ac.lastAltFt = alt;
    ctx.ac.lastFl = undefined;
    const altText = slot(ctx, formatAltitude(alt, ctx.mode));
    return {
      clause: `descend and maintain ${altText}`,
      readback: `descending ${altText}`,
    };
  },
};

export const CLAUSE_EXPEDITE: ClauseSpec = {
  kind: 'expedite',
  minLevel: 'C2',
  order: 4,
  make(ctx) {
    const fl = ctx.rng.intStep(100, 180, 10);
    const flText = slot(ctx, formatFlightLevel(fl, ctx.mode));
    return {
      clause: `expedite descent through flight level ${flText}`,
      readback: `expediting through flight level ${flText}`,
    };
  },
};

export const CLAUSE_SPEED: ClauseSpec = {
  kind: 'speed',
  minLevel: 'B2',
  order: 5,
  make(ctx) {
    const phase = ctx.ac.phase;
    const [lo, hi] = phase === 'ENROUTE' ? [260, 300] : phase === 'DESCENT' ? [210, 250] : [160, 200];
    let spd = ctx.rng.intStep(lo, hi, 10);
    if (ctx.ac.lastSpd && spd >= ctx.ac.lastSpd) spd = Math.max(lo, ctx.ac.lastSpd - 10);
    ctx.ac.lastSpd = spd;
    const spdText = slot(ctx, formatSpeed(spd, ctx.mode));
    const variants = [`reduce speed to ${spdText} knots`, `maintain ${spdText} knots`];
    if (levelAtLeast(ctx.level, 'C1')) {
      variants.push(`maintain ${spdText} knots or greater`);
    }
    return { clause: ctx.rng.pick(variants), readback: `speed ${spdText} knots` };
  },
};

export const CLAUSE_SQUAWK: ClauseSpec = {
  kind: 'squawk',
  minLevel: 'B2',
  order: 6,
  make(ctx) {
    if (levelAtLeast(ctx.level, 'C1') && ctx.rng.chance(0.2)) {
      ctx.slots.push('ident');
      return { clause: 'squawk ident', readback: 'ident' };
    }
    const code = slot(ctx, formatSquawk(makeSquawkCode(ctx.rng), ctx.mode));
    return { clause: `squawk ${code}`, readback: `squawk ${code}` };
  },
};

export const CLAUSE_QNH: ClauseSpec = {
  kind: 'qnh',
  minLevel: 'B2',
  order: 7,
  make(ctx) {
    ctx.ac.qnhGiven = true;
    const p = pressure(ctx);
    return { clause: `${p.label} ${p.value}`, readback: `${p.label} ${p.value}` };
  },
};

export function makeContactClause(facility: 'approach' | 'departure' | 'center'): ClauseSpec {
  return {
    kind: 'contact',
    minLevel: 'B1',
    order: 9,
    make(ctx) {
      const name = ctx.scenario.airport[facility];
      const f = freqOf(ctx, facility);
      const tail = ctx.rng.chance(0.4) ? ', good day' : '';
      return {
        clause: `contact ${name} on ${f}${tail}`,
        readback: `over to ${name} ${f}`,
      };
    },
  };
}

/** Assemble "CALLSIGN, clause, clause, clause." from picked clauses. */
export function composeClauses(
  ctx: BuildCtx,
  clauses: { clause: string; readback?: string }[],
): Built {
  const text = `${cs(ctx)}, ${clauses.map((c) => c.clause).join(', ')}.`;
  const rbParts = clauses.map((c) => c.readback).filter(Boolean) as string[];
  const readback = rbParts.length
    ? `${rbParts.join(', ').replace(/^./, (m) => m.toUpperCase())}, ${cs(ctx)}.`
    : undefined;
  return { text, readback, instructions: clauses.length };
}
