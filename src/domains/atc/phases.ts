/**
 * Flight-phase state machine. Every aircraft in the session walks a
 * realistic arc; transmissions are only ever emitted for the aircraft's
 * current phase, which is what keeps the stream coherent.
 *
 *  Departure: PARKED → PUSHBACK → TAXI_OUT → HOLD_SHORT → LINEUP → TAKEOFF → DEPARTED
 *  Arrival:   ENROUTE → DESCENT → APPROACH → FINAL → LANDED → GATE
 *  Go-around: FINAL → GO_AROUND → APPROACH (one loop max)
 */

export type Phase =
  | 'PARKED'
  | 'PUSHBACK'
  | 'TAXI_OUT'
  | 'HOLD_SHORT'
  | 'LINEUP'
  | 'TAKEOFF'
  | 'DEPARTED'
  | 'ENROUTE'
  | 'DESCENT'
  | 'APPROACH'
  | 'FINAL'
  | 'GO_AROUND'
  | 'LANDED'
  | 'GATE';

export type FlightKind = 'departure' | 'arrival';

/** Phases an aircraft may move to next (staying put is always allowed). */
export const ALLOWED_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  PARKED: ['PUSHBACK'],
  PUSHBACK: ['TAXI_OUT'],
  TAXI_OUT: ['HOLD_SHORT'],
  HOLD_SHORT: ['LINEUP', 'TAKEOFF'],
  LINEUP: ['TAKEOFF'],
  TAKEOFF: ['DEPARTED'],
  DEPARTED: [],
  ENROUTE: ['DESCENT'],
  DESCENT: ['APPROACH'],
  APPROACH: ['FINAL'],
  FINAL: ['LANDED', 'GO_AROUND'],
  GO_AROUND: ['APPROACH'],
  LANDED: ['GATE'],
  GATE: [],
};

export const TERMINAL_PHASES: readonly Phase[] = ['DEPARTED', 'GATE'];

export function isTerminal(phase: Phase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

export function isValidTransition(from: Phase, to: Phase): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

/** Airborne phases where combined clause instructions make sense. */
export const AIRBORNE_PHASES: readonly Phase[] = [
  'TAKEOFF',
  'ENROUTE',
  'DESCENT',
  'APPROACH',
  'FINAL',
  'GO_AROUND',
];
