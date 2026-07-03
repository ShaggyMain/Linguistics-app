/**
 * Starting-speed suggestion (SPEC §7): base WPM comes from the CEFR
 * level; the generated content's density nudges it slightly — denser
 * multi-instruction transmissions read a touch slower, short simple
 * calls a touch faster.
 */

import type { Level, LevelId } from '../domains/types';

export const WPM_MIN = 80;
export const WPM_MAX = 240;
export const WPM_STEP = 2;

export function clampWpm(wpm: number): number {
  return Math.min(WPM_MAX, Math.max(WPM_MIN, Math.round(wpm / WPM_STEP) * WPM_STEP));
}

export function baseWpmFor(levels: Level[], level: LevelId): number {
  return levels.find((l) => l.id === level)?.suggestedWpm ?? 120;
}

/** Refine a base suggestion using average words per transmission. */
export function autoSpeed(baseWpm: number, avgWordsPerTransmission: number): number {
  // ~11 words/transmission is the neutral point; ±1.2% per word around it.
  const factor = 1 - (avgWordsPerTransmission - 11) * 0.012;
  return clampWpm(baseWpm * Math.min(1.08, Math.max(0.9, factor)));
}
