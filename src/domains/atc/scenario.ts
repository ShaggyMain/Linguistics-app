/**
 * The "live field" layer that makes a session feel like one real place
 * instead of disconnected random sentences:
 *
 *  - one airport per session, with its real runway layout
 *  - wind is generated first and the active runway ends are chosen
 *    INTO the wind, then every clearance uses those same runways
 *  - wind drifts gently during the session (a fresh value on every
 *    wind report, but never a teleporting one)
 *  - one frequency per facility, fixed for the whole session, so every
 *    handoff to e.g. "Boston Approach" uses the same number
 *  - ATIS letter and QNH stay consistent; the ATIS may roll over once
 *    mid-session, which triggers an "information ... now current" call
 */

import { Rng } from '../../core/random';
import {
  AIRPORTS,
  AirportSpec,
  PHONETIC,
  angularDiff,
  runwayHeading,
} from './pools';
import type { Wind } from './readout';

export interface Facilities {
  ground: number;
  tower: number;
  approach: number;
  departure: number;
  center: number;
}

function randomFreq(rng: Rng, minMhz: number, maxMhz: number): number {
  // 25 kHz channel spacing.
  const steps = Math.round((maxMhz - minMhz) / 0.025);
  return +(minMhz + rng.int(0, steps) * 0.025).toFixed(3);
}

export class Scenario {
  readonly airport: AirportSpec;
  readonly freqs: Facilities;
  /** Active runway for departures / arrivals (may be the same strip). */
  readonly depRunway: string;
  readonly arrRunway: string;

  wind: Wind;
  qnh: number;
  atis: string;
  private atisRolled = false;

  constructor(private readonly rng: Rng) {
    this.airport = rng.pick(AIRPORTS);

    // Wind first, runways second — runway in use faces the wind.
    const dir = rng.intStep(10, 360, 10);
    const speed = rng.int(4, 18);
    const gust = speed >= 14 && rng.chance(0.4) ? speed + rng.int(6, 12) : undefined;
    this.wind = { dir, speed, gust };

    const pairs = rng.shuffle(this.airport.pairs);
    const intoWind = (pair: { a: string; b: string }): string => {
      const da = angularDiff(runwayHeading(pair.a), dir);
      const db = angularDiff(runwayHeading(pair.b), dir);
      return da <= db ? pair.a : pair.b;
    };
    this.depRunway = intoWind(pairs[0]);
    this.arrRunway = intoWind(pairs.length > 1 ? pairs[1] : pairs[0]);

    this.qnh =
      this.airport.pressureUnit === 'hPa'
        ? rng.int(995, 1032)
        : +(29.55 + rng.int(0, 80) * 0.01).toFixed(2);

    this.atis = rng.pick(PHONETIC.slice(0, 20));

    const tower = randomFreq(rng, 118.0, 120.975);
    this.freqs = {
      ground: randomFreq(rng, 121.6, 121.975),
      tower,
      approach: randomFreq(rng, 119.0, 127.975),
      departure: randomFreq(rng, 120.0, 126.975),
      center: randomFreq(rng, 127.0, 135.975),
    };
  }

  /** All runway idents that may legitimately appear in this session. */
  get activeRunways(): string[] {
    return this.depRunway === this.arrRunway
      ? [this.depRunway]
      : [this.depRunway, this.arrRunway];
  }

  /**
   * Gentle random walk so consecutive wind reports differ but stay
   * believable. Returns true when the ATIS rolled over (once max).
   */
  evolve(): boolean {
    const w = this.wind;
    const dir = ((w.dir + this.rng.intStep(-10, 10, 10) + 359) % 360) + 1;
    const speed = Math.min(28, Math.max(3, w.speed + this.rng.int(-2, 2)));
    let gust = w.gust;
    if (gust) {
      gust = Math.max(speed + 5, gust + this.rng.int(-2, 2));
      if (this.rng.chance(0.15)) gust = undefined;
    } else if (speed >= 15 && this.rng.chance(0.12)) {
      gust = speed + this.rng.int(6, 12);
    }
    this.wind = { dir: Math.round(dir / 10) * 10 || 360, speed, gust };

    if (!this.atisRolled && this.rng.chance(0.02)) {
      this.atisRolled = true;
      const idx = PHONETIC.indexOf(this.atis as (typeof PHONETIC)[number]);
      this.atis = PHONETIC[(idx + 1) % PHONETIC.length];
      return true;
    }
    return false;
  }
}
