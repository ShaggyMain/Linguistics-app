/** Aircraft state: identity, assigned runway, phase, and flow memory. */

import { Rng } from '../../core/random';
import type { LevelId } from '../types';
import { AIRCRAFT_TYPES, AIRLINES, AircraftType, PHONETIC } from './pools';
import type { FlightKind, Phase } from './phases';
import { formatFlightNumber, ReadoutMode, spellDigits } from './readout';
import type { Scenario } from './scenario';

export interface AircraftState {
  /** Display callsign, already formatted for the session readout mode. */
  display: string;
  telephony: string;
  /** Raw flight number (airline traffic only), for anti-repeat tracking. */
  flightNumber?: number;
  kind: FlightKind;
  phase: Phase;
  runway: string;
  type: AircraftType;

  /* Flow memory — keeps values plausible across the aircraft's arc. */
  towerContacted: boolean;
  goAroundDone: boolean;
  /** QNH/altimeter already passed to this aircraft (give it only once). */
  qnhGiven: boolean;
  emergency: boolean;
  /** 0 = PAN not yet acknowledged, 1 = inbound priority, 2 = done. */
  emergencyStage: 0 | 1 | 2;
  /**
   * Set after a conditional line-up: display callsign of the arrival this
   * aircraft is waiting behind. While set, it does not block that arrival.
   */
  waitingBehind?: string;
  lastFl?: number;
  lastAltFt?: number;
  lastSpd?: number;
  /** Turns since this aircraft last transmitted (anti-starvation). */
  idleTurns: number;
}

export interface SpawnOptions {
  kind: FlightKind;
  entryPhase: Phase;
  emergency?: boolean;
  /** Telephony designators already in use (must stay unique). */
  usedTelephony: ReadonlySet<string>;
  /** Recently used flight numbers to avoid. */
  recentNumbers: ReadonlySet<number>;
}

export function spawnAircraft(
  rng: Rng,
  scenario: Scenario,
  level: LevelId,
  mode: ReadoutMode,
  opts: SpawnOptions,
): AircraftState {
  const isGa = rng.chance(0.07);

  let display: string;
  let telephony: string;
  let type: AircraftType;
  let flightNumber: number | undefined;

  if (isGa) {
    const gaTypes = AIRCRAFT_TYPES.filter((t) => t.ga);
    type = rng.pick(gaTypes);
    const digits = String(rng.int(10, 979));
    const letters = `${rng.pick(PHONETIC)} ${rng.pick(PHONETIC)}`;
    telephony = `November-${digits}`;
    display =
      mode === 'aviation'
        ? `November ${spellDigits(digits)} ${letters}`
        : `November ${digits} ${letters}`;
  } else {
    const jets = AIRCRAFT_TYPES.filter((t) => !t.ga);
    type = rng.pick(jets);
    let airline = rng.pick(AIRLINES).telephony;
    for (let i = 0; i < 12 && opts.usedTelephony.has(airline); i++) {
      airline = rng.pick(AIRLINES).telephony;
    }
    let num = rng.int(2, 999);
    for (let i = 0; i < 12 && opts.recentNumbers.has(num); i++) {
      num = rng.int(2, 999);
    }
    telephony = airline;
    flightNumber = num;
    display = `${airline} ${formatFlightNumber(num, mode)}`;
  }

  // Light GA aircraft taxi from the apron under their own power —
  // skip the pushback call and start with the taxi instruction.
  let entryPhase = opts.entryPhase;
  if (isGa && opts.kind === 'departure' && entryPhase === 'PARKED') {
    entryPhase = 'PUSHBACK';
  }

  return {
    display,
    telephony,
    flightNumber,
    kind: opts.kind,
    phase: entryPhase,
    runway: opts.kind === 'departure' ? scenario.depRunway : scenario.arrRunway,
    type,
    towerContacted: false,
    goAroundDone: false,
    qnhGiven: false,
    emergency: opts.emergency ?? false,
    emergencyStage: 0,
    lastFl: opts.entryPhase === 'ENROUTE' ? rng.intStep(280, 380, 10) : undefined,
    lastAltFt: undefined,
    lastSpd: undefined,
    idleTurns: 0,
  };
}
