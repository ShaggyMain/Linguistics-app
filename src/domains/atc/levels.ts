import type { Level, LevelId } from '../types';
import type { ReadoutMode } from './readout';

/** Per-level tuning of density, speed, vocabulary and event probabilities. */
export interface AtcLevelConfig {
  id: LevelId;
  suggestedWpm: number;
  /** Min/max clauses combined into one airborne transmission. */
  clauseRange: [number, number];
  /** Probability that an aircraft on FINAL is sent around. */
  goAroundProb: number;
  /** Probability that a newly spawned arrival is an emergency (PAN PAN). */
  emergencyProb: number;
  /** Default number readout when the app setting is 'auto'. */
  defaultReadout: ReadoutMode;
  /** Categories a session at this level is expected to cover. */
  expectedCategories: readonly string[];
}

export const ATC_LEVEL_CONFIGS: Record<LevelId, AtcLevelConfig> = {
  B1: {
    id: 'B1',
    suggestedWpm: 100,
    clauseRange: [1, 1],
    goAroundProb: 0,
    emergencyProb: 0,
    defaultReadout: 'digits',
    expectedCategories: ['ground', 'tower', 'approach'],
  },
  B2: {
    id: 'B2',
    suggestedWpm: 128,
    clauseRange: [1, 2],
    goAroundProb: 0.05,
    emergencyProb: 0,
    defaultReadout: 'digits',
    expectedCategories: ['ground', 'tower', 'approach', 'enroute'],
  },
  C1: {
    id: 'C1',
    suggestedWpm: 158,
    clauseRange: [2, 3],
    goAroundProb: 0.08,
    emergencyProb: 0.18,
    defaultReadout: 'digits',
    expectedCategories: ['ground', 'tower', 'approach', 'enroute', 'nonnormal'],
  },
  C2: {
    id: 'C2',
    suggestedWpm: 185,
    clauseRange: [2, 4],
    goAroundProb: 0.1,
    emergencyProb: 0.22,
    defaultReadout: 'aviation',
    expectedCategories: ['ground', 'tower', 'approach', 'enroute', 'nonnormal'],
  },
};

export const ATC_LEVELS: Level[] = [
  {
    id: 'B1',
    label: 'B1',
    description: 'Core phraseology, single instructions, easy pace',
    suggestedWpm: ATC_LEVEL_CONFIGS.B1.suggestedWpm,
  },
  {
    id: 'B2',
    label: 'B2',
    description: 'Vectors, climbs and squawks, up to two instructions',
    suggestedWpm: ATC_LEVEL_CONFIGS.B2.suggestedWpm,
  },
  {
    id: 'C1',
    label: 'C1',
    description: 'Combined clearances, sequencing, traffic, non-normal',
    suggestedWpm: ATC_LEVEL_CONFIGS.C1.suggestedWpm,
  },
  {
    id: 'C2',
    label: 'C2',
    description: 'Dense clearances, spelled numbers, fastest stream',
    suggestedWpm: ATC_LEVEL_CONFIGS.C2.suggestedWpm,
  },
];

const LEVEL_ORDER: LevelId[] = ['B1', 'B2', 'C1', 'C2'];

export function levelAtLeast(level: LevelId, min: LevelId): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);
}
