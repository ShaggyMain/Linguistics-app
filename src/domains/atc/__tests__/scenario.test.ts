import { Rng } from '../../../core/random';
import { angularDiff, runwayHeading } from '../pools';
import { Scenario } from '../scenario';

describe('scenario (live field)', () => {
  test('active runways face the wind and belong to the airport', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sc = new Scenario(new Rng(seed));
      const ends = sc.airport.pairs.flatMap((p) => [p.a, p.b]);
      for (const rwy of sc.activeRunways) {
        expect(ends).toContain(rwy);
        expect(angularDiff(runwayHeading(rwy), sc.wind.dir)).toBeLessThanOrEqual(90);
      }
    }
  });

  test('frequencies sit in the airband on the 25 kHz grid', () => {
    const sc = new Scenario(new Rng(7));
    for (const freq of Object.values(sc.freqs)) {
      expect(freq).toBeGreaterThanOrEqual(118);
      expect(freq).toBeLessThanOrEqual(136.975);
      expect(Math.round(freq * 1000) % 25).toBe(0);
    }
  });

  test('weather evolves gently and stays in plausible bounds', () => {
    const sc = new Scenario(new Rng(11));
    for (let i = 0; i < 200; i++) {
      const before = sc.wind;
      sc.evolve();
      const after = sc.wind;
      expect(after.dir).toBeGreaterThanOrEqual(10);
      expect(after.dir).toBeLessThanOrEqual(360);
      expect(after.dir % 10).toBe(0);
      expect(after.speed).toBeGreaterThanOrEqual(3);
      expect(after.speed).toBeLessThanOrEqual(28);
      if (after.gust) expect(after.gust).toBeGreaterThan(after.speed);
      // Direction never teleports more than one 10° step at a time.
      const delta = angularDiff(before.dir, after.dir);
      expect(delta).toBeLessThanOrEqual(10);
    }
  });

  test('QNH matches the airport pressure unit', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sc = new Scenario(new Rng(seed));
      if (sc.airport.pressureUnit === 'hPa') {
        expect(Number.isInteger(sc.qnh)).toBe(true);
        expect(sc.qnh).toBeGreaterThanOrEqual(995);
        expect(sc.qnh).toBeLessThanOrEqual(1032);
      } else {
        expect(sc.qnh).toBeGreaterThanOrEqual(29.55);
        expect(sc.qnh).toBeLessThanOrEqual(30.35);
      }
    }
  });
});
