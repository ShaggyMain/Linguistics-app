/**
 * Deterministic, seedable randomness for the procedural generators.
 * Everything the generators do flows through `Rng`, so a fixed seed
 * reproduces an identical session — which the tests rely on.
 */

export type Rand = () => number;

/** Small, fast, good-enough PRNG (mulberry32). */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private rand: Rand;

  constructor(seed?: number) {
    this.rand = mulberry32((seed ?? Date.now()) >>> 0);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.rand();
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + (max - min) * this.rand();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Integer in [min, max] snapped to `step` (e.g. headings in 5° steps). */
  intStep(min: number, max: number, step: number): number {
    const n = Math.floor((max - min) / step);
    return min + this.int(0, n) * step;
  }

  chance(p: number): boolean {
    return this.rand() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weightOf(it));
    if (total <= 0) return this.pick(items);
    let roll = this.float(0, total);
    for (const it of items) {
      roll -= Math.max(0, weightOf(it));
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/**
 * Draws items without replacement; reshuffles when exhausted and avoids
 * repeating the last drawn item across the refill boundary. This is the
 * "shuffled pools instead of sampling with replacement" requirement.
 */
export class ShuffleBag<T> {
  private bag: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly rng: Rng,
  ) {}

  draw(): T {
    if (this.bag.length === 0) {
      this.bag = this.rng.shuffle(this.items);
      if (this.items.length > 1 && this.bag[this.bag.length - 1] === this.last) {
        const j = this.rng.int(0, this.bag.length - 2);
        [this.bag[this.bag.length - 1], this.bag[j]] = [this.bag[j], this.bag[this.bag.length - 1]];
      }
    }
    this.last = this.bag.pop() as T;
    return this.last;
  }
}
