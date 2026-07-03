/** Word counting + reading-time estimates shared by generator and UI. */

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Estimated seconds to read `words` at `wpm`. */
export function estimateSeconds(words: number, wpm: number): number {
  if (wpm <= 0) return 0;
  return (words / wpm) * 60;
}

/** Words needed to fill `seconds` of reading at `wpm`. */
export function wordsForSeconds(seconds: number, wpm: number): number {
  return Math.ceil((seconds / 60) * wpm);
}
