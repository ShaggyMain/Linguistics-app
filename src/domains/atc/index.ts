import type { Domain } from '../types';
import { ATC_LEVELS } from './levels';
import { createAtcSession } from './session';

export const atcDomain: Domain = {
  id: 'atc',
  name: 'Air Traffic Controller',
  tagline: 'Live-frequency ICAO phraseology: clearances, vectors, handoffs',
  available: true,
  levels: ATC_LEVELS,
  createSession: createAtcSession,
};
