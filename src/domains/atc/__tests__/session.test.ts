import type { LevelId, SignatureHistory, Transmission } from '../../types';
import { ATC_LEVEL_CONFIGS } from '../levels';
import { isValidTransition, Phase } from '../phases';
import { AtcSession } from '../session';

function makeSession(
  level: LevelId,
  seed: number,
  settings?: ConstructorParameters<typeof AtcSession>[0]['settings'],
  history?: SignatureHistory,
) {
  return new AtcSession({ level, seed, settings, history });
}

function draw(session: AtcSession, n: number): Transmission[] {
  const out: Transmission[] = [];
  for (let i = 0; i < n; i++) out.push(session.next());
  return out;
}

const controllersOf = (txns: Transmission[]) =>
  txns.filter((t) => t.meta?.role === 'controller');

/** Key phrases a transmission must contain to count as known phraseology. */
const KNOWN_PHRASES = [
  'pushback approved',
  'push and start approved',
  'taxi',
  'hold short',
  'hold position',
  'give way',
  'continue holding short',
  'line up and wait',
  'cleared for takeoff',
  'cleared for immediate takeoff',
  'cleared to land',
  'continue approach',
  'go around',
  'contact',
  'climb',
  'descend',
  'turn left heading',
  'turn right heading',
  'fly heading',
  'fly runway heading',
  'proceed direct',
  'squawk',
  'QNH',
  'altimeter',
  'speed',
  'knots',
  'cleared ILS approach',
  'cleared RNAV approach',
  'cleared straight-in ILS approach',
  'report established',
  'number',
  'follow the',
  'traffic',
  'wind check',
  'vacate',
  'PAN PAN',
  'now current',
  'expedite descent',
  'report in sight',
];

describe('anti-repetition (SPEC §6.6, §11)', () => {
  test('300 transmissions: no signature repeats within a 50-window, none consecutive identical', () => {
    const txns = draw(makeSession('B2', 42), 300);
    const controllers = controllersOf(txns);

    // Signature never repeats within any sliding window of 50.
    const sigs = txns.map((t) => t.meta?.signature as string).filter(Boolean);
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < Math.min(i + 50, sigs.length); j++) {
        expect(sigs[j]).not.toBe(sigs[i]);
      }
    }

    // No two identical texts in a row, ever.
    for (let i = 1; i < txns.length; i++) {
      expect(txns[i].text).not.toBe(txns[i - 1].text);
    }

    // No same callsign twice in a row, no same template twice in a row.
    for (let i = 1; i < controllers.length; i++) {
      expect(controllers[i].meta?.callsign).not.toBe(controllers[i - 1].meta?.callsign);
      expect(controllers[i].meta?.templateKey).not.toBe(controllers[i - 1].meta?.templateKey);
    }
  });

  test('persisted history is respected and appended', () => {
    const seen = new Set<string>();
    const history: SignatureHistory = {
      has: (sig) => seen.has(sig),
      push: (sig) => void seen.add(sig),
    };

    const first = makeSession('B2', 42).next();
    seen.add(first.meta?.signature as string);

    const txns = draw(makeSession('B2', 42, undefined, history), 60);
    // The preloaded signature must never be emitted again.
    for (const t of txns) {
      expect(t.meta?.signature).not.toBe(first.meta?.signature);
    }
    // The bridge accumulated the new signatures.
    expect(seen.size).toBeGreaterThan(50);
  });
});

describe('phraseology validity (SPEC §11)', () => {
  const sessions: Array<[LevelId, number]> = [
    ['B1', 1],
    ['B2', 42],
    ['C1', 7],
    ['C2', 13],
  ];

  test.each(sessions)('%s: structure, slots and ranges are valid', (level, seed) => {
    const session = makeSession(level, seed);
    const active = session.scenario.activeRunways;
    const unit = session.scenario.airport.pressureUnit;
    const txns = draw(session, 300);

    for (const t of txns) {
      const text = t.text;

      // No unfilled slots, junk values or double spaces; ends as a sentence.
      expect(text).not.toMatch(/[{}]/);
      expect(text).not.toMatch(/undefined|NaN|null/);
      expect(text).not.toMatch(/ {2}/);
      expect(text).toMatch(/\.$/);

      // Addressed to a known aircraft (except all-stations broadcasts).
      if (t.meta?.role !== 'broadcast') {
        expect(text.startsWith(`${t.meta?.callsign},`)).toBe(true);
      }

      // Recognisable phraseology.
      expect(KNOWN_PHRASES.some((p) => text.includes(p))).toBe(true);

      // Runways: only the session's active runways ever get used.
      for (const m of text.matchAll(/runway (\d{2,3}[LCR]?)\b/g)) {
        expect(active).toContain(m[1]);
      }

      if (level !== 'C2') {
        // Digit-mode slot checks (C2 spells numbers as words).
        for (const m of text.matchAll(/heading (\d{3})\b/g)) {
          const h = parseInt(m[1], 10);
          expect(h).toBeGreaterThanOrEqual(5);
          expect(h).toBeLessThanOrEqual(360);
          expect(h % 5).toBe(0);
        }
        for (const m of text.matchAll(/squawk (\d{4})\b/g)) {
          expect(m[1]).toMatch(/^[0-7]{4}$/);
          expect(['7500', '7600', '7700']).not.toContain(m[1]);
        }
        for (const m of text.matchAll(/\b(1[123][0-9]\.\d{1,3})\b/g)) {
          const f = parseFloat(m[1]);
          expect(f).toBeGreaterThanOrEqual(118);
          expect(f).toBeLessThanOrEqual(136.975);
          expect(Math.round(f * 1000) % 25).toBe(0);
        }
        for (const m of text.matchAll(/(\d{3}) knots/g)) {
          const s = parseInt(m[1], 10);
          expect(s).toBeGreaterThanOrEqual(140);
          expect(s).toBeLessThanOrEqual(320);
        }
        for (const m of text.matchAll(/maintain (\d{4,5})\b(?! knots)/g)) {
          const a = parseInt(m[1], 10);
          expect(a % 1000).toBe(0);
          expect(a).toBeGreaterThanOrEqual(3000);
          expect(a).toBeLessThanOrEqual(11000);
        }
        for (const m of text.matchAll(/flight level (\d{2,3})\b/g)) {
          const fl = parseInt(m[1], 10);
          expect(fl).toBeGreaterThanOrEqual(60);
          expect(fl).toBeLessThanOrEqual(390);
          expect(fl % 10).toBe(0);
        }
        for (const m of text.matchAll(/wind(?: check,)? (\d{3}) at (\d{1,2})\b/g)) {
          const dir = parseInt(m[1], 10);
          const spd = parseInt(m[2], 10);
          expect(dir % 10).toBe(0);
          expect(dir).toBeGreaterThanOrEqual(10);
          expect(dir).toBeLessThanOrEqual(360);
          expect(spd).toBeGreaterThanOrEqual(3);
          expect(spd).toBeLessThanOrEqual(28);
        }
        if (unit === 'hPa') {
          for (const m of text.matchAll(/QNH (\d{3,4})\b/g)) {
            const q = parseInt(m[1], 10);
            expect(q).toBeGreaterThanOrEqual(995);
            expect(q).toBeLessThanOrEqual(1032);
          }
        } else {
          for (const m of text.matchAll(/altimeter (\d{2}\.\d{2})\b/g)) {
            const q = parseFloat(m[1]);
            expect(q).toBeGreaterThanOrEqual(29.55);
            expect(q).toBeLessThanOrEqual(30.35);
          }
        }
      } else {
        // C2 aviation readout: no bare figures should remain in
        // instruction slots (runways/frequencies/headings are words).
        expect(text).not.toMatch(/heading \d/);
        expect(text).not.toMatch(/squawk \d/);
        expect(text).not.toMatch(/flight level \d/);
        expect(text).not.toMatch(/runway \d/);
      }
    }
  });
});

describe('flight-phase coherence (SPEC §6.3, §11)', () => {
  test.each<[LevelId, number]>([
    ['B1', 1],
    ['B2', 42],
    ['C2', 13],
  ])('%s: every callsign follows a legal phase arc', (level, seed) => {
    const txns = draw(makeSession(level, seed), 400);
    const arcs = new Map<string, Phase[]>();
    for (const t of controllersOf(txns)) {
      const cs = t.meta?.callsign as string;
      const phase = t.meta?.phase as Phase;
      if (!arcs.has(cs)) arcs.set(cs, []);
      arcs.get(cs)!.push(phase);
    }
    expect(arcs.size).toBeGreaterThan(5);
    for (const [, phases] of arcs) {
      for (let i = 1; i < phases.length; i++) {
        expect(isValidTransition(phases[i - 1], phases[i])).toBe(true);
      }
    }
  });

  test('departures reach DEPARTED, arrivals reach GATE (aircraft actually flow)', () => {
    const txns = draw(makeSession('B2', 42), 400);
    const phases = new Set(controllersOf(txns).map((t) => t.meta?.phase));
    expect(phases.has('DEPARTED')).toBe(true);
    expect(phases.has('GATE')).toBe(true);
  });
});

describe('level scaling (SPEC §6.5, §11)', () => {
  const avgInstructions = (level: LevelId, seed: number): number => {
    const txns = controllersOf(draw(makeSession(level, seed), 400));
    const total = txns.reduce((sum, t) => sum + ((t.meta?.instructions as number) ?? 0), 0);
    return total / txns.length;
  };

  test('instruction density grows B1 < B2 < C1 < C2', () => {
    const b1 = avgInstructions('B1', 7);
    const b2 = avgInstructions('B2', 7);
    const c1 = avgInstructions('C1', 7);
    const c2 = avgInstructions('C2', 7);
    expect(b1).toBeLessThan(b2);
    expect(b2).toBeLessThan(c1);
    expect(c1).toBeLessThan(c2);
  });

  test('suggested WPM grows with level', () => {
    expect(ATC_LEVEL_CONFIGS.B1.suggestedWpm).toBeLessThan(ATC_LEVEL_CONFIGS.B2.suggestedWpm);
    expect(ATC_LEVEL_CONFIGS.B2.suggestedWpm).toBeLessThan(ATC_LEVEL_CONFIGS.C1.suggestedWpm);
    expect(ATC_LEVEL_CONFIGS.C1.suggestedWpm).toBeLessThan(ATC_LEVEL_CONFIGS.C2.suggestedWpm);
  });

  test('non-normal situations never appear below C1', () => {
    for (const [level, seed] of [
      ['B1', 3],
      ['B2', 3],
    ] as Array<[LevelId, number]>) {
      const txns = draw(makeSession(level, seed), 800);
      expect(txns.some((t) => t.meta?.category === 'nonnormal')).toBe(false);
    }
  });

  test('non-normal situations appear from C1 up', () => {
    for (const [level, seed] of [
      ['C1', 7],
      ['C2', 13],
    ] as Array<[LevelId, number]>) {
      const txns = draw(makeSession(level, seed), 800);
      expect(txns.some((t) => t.meta?.category === 'nonnormal')).toBe(true);
    }
  });
});

describe('topic coverage (SPEC §6.7, §11)', () => {
  test.each<[LevelId, number]>([
    ['B1', 1],
    ['B2', 42],
    ['C1', 7],
    ['C2', 13],
  ])('%s: 300 transmissions cover all expected categories', (level, seed) => {
    const txns = draw(makeSession(level, seed), 300);
    const seen = new Set(txns.map((t) => t.meta?.category));
    for (const cat of ATC_LEVEL_CONFIGS[level].expectedCategories) {
      expect(seen).toContain(cat);
    }
  });
});

describe('determinism & options', () => {
  test('same seed → identical stream, different seed → different stream', () => {
    const a = draw(makeSession('C1', 99), 25).map((t) => t.text);
    const b = draw(makeSession('C1', 99), 25).map((t) => t.text);
    const c = draw(makeSession('C1', 100), 25).map((t) => t.text);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  test('pilot readbacks add pilot lines for the same callsign', () => {
    const txns = draw(makeSession('B2', 42, { pilotReadbacks: true }), 120);
    const pilots = txns.filter((t) => t.meta?.role === 'pilot');
    expect(pilots.length).toBeGreaterThan(20);
    for (let i = 1; i < txns.length; i++) {
      if (txns[i].meta?.role === 'pilot') {
        expect(txns[i - 1].meta?.role).toBe('controller');
        expect(txns[i].meta?.callsign).toBe(txns[i - 1].meta?.callsign);
      }
    }
  });

  test('aviation readout spells numbers as words', () => {
    const txns = draw(makeSession('B2', 42, { numberReadout: 'aviation' }), 150);
    const joined = txns.map((t) => t.text).join(' ');
    expect(joined).toMatch(/\b(one|two|three|four|five|six|seven|eight|niner|zero)\b/);
    expect(joined).not.toMatch(/heading \d/);
    expect(joined).not.toMatch(/squawk \d/);
  });
});
