/**
 * Number formatting in two modes:
 *  - 'digits'   → visual figures ("heading 310", "119.1", "QNH 1013")
 *  - 'aviation' → spelled ICAO readout ("heading three one zero",
 *                 "one one niner decimal one", "QNH one zero one three")
 */

export type ReadoutMode = 'digits' | 'aviation';

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'niner',
  '.': 'decimal',
};

/** Spell a figure string digit by digit ("310" → "three one zero"). */
export function spellDigits(figures: string): string {
  return figures
    .split('')
    .map((ch) => DIGIT_WORDS[ch] ?? ch)
    .join(' ');
}

export function formatHeading(hdg: number, mode: ReadoutMode): string {
  const figures = String(hdg).padStart(3, '0');
  return mode === 'aviation' ? spellDigits(figures) : figures;
}

/** Runway ident: "27R" → "two seven right" in aviation mode. */
export function formatRunway(rwy: string, mode: ReadoutMode): string {
  if (mode !== 'aviation') return rwy;
  const digits = rwy.replace(/[LCR]$/, '');
  const suffix = rwy.endsWith('L')
    ? ' left'
    : rwy.endsWith('R')
      ? ' right'
      : rwy.endsWith('C')
        ? ' center'
        : '';
  return `${spellDigits(digits)}${suffix}`;
}

export function formatFrequency(freqMhz: number, mode: ReadoutMode): string {
  // Trim trailing zeros but keep at least one decimal: 118.700 → "118.7"
  let text = freqMhz.toFixed(3);
  text = text.replace(/0+$/, '');
  if (text.endsWith('.')) text += '0';
  return mode === 'aviation' ? spellDigits(text) : text;
}

export function formatSquawk(code: string, mode: ReadoutMode): string {
  return mode === 'aviation' ? spellDigits(code) : code;
}

export function formatFlightLevel(fl: number, mode: ReadoutMode): string {
  const figures = String(fl);
  return mode === 'aviation' ? spellDigits(figures) : figures;
}

/**
 * Altitudes below the transition level, in feet.
 * digits: "4000" / "11000"; aviation: "four thousand" / "one one thousand".
 */
export function formatAltitude(feet: number, mode: ReadoutMode): string {
  if (mode === 'digits') return String(feet);
  const thousands = Math.floor(feet / 1000);
  const hundreds = Math.floor((feet % 1000) / 100);
  const thousandWords =
    thousands >= 10 ? spellDigits(String(thousands)) : DIGIT_WORDS[String(thousands)];
  let out = `${thousandWords} thousand`;
  if (hundreds > 0) out += ` ${DIGIT_WORDS[String(hundreds)]} hundred`;
  return out;
}

export function formatSpeed(knots: number, mode: ReadoutMode): string {
  return mode === 'aviation' ? spellDigits(String(knots)) : String(knots);
}

export interface Wind {
  dir: number;
  speed: number;
  gust?: number;
}

export function formatWind(wind: Wind, mode: ReadoutMode): string {
  const dir = formatHeading(wind.dir, mode);
  const spd = mode === 'aviation' ? spellDigits(String(wind.speed)) : String(wind.speed);
  let out = `${dir} at ${spd}`;
  if (wind.gust) {
    out += ` gusting ${mode === 'aviation' ? spellDigits(String(wind.gust)) : String(wind.gust)}`;
  }
  return out;
}

/** QNH hPa ("1013") or US altimeter inches ("29.92"). */
export function formatPressure(value: number, unit: 'hPa' | 'inHg', mode: ReadoutMode): string {
  const figures = unit === 'hPa' ? String(Math.round(value)) : value.toFixed(2);
  if (mode !== 'aviation') return figures;
  return spellDigits(unit === 'hPa' ? figures : figures.replace('.', ''));
}

/** Flight number: digits "407" or spoken "four zero seven". */
export function formatFlightNumber(num: number, mode: ReadoutMode): string {
  return mode === 'aviation' ? spellDigits(String(num)) : String(num);
}
