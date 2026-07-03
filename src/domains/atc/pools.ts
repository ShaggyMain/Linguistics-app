/**
 * Data banks for the ATC generator: airline telephony designators,
 * aircraft types with wake categories, phonetic alphabet, invented
 * waypoint fixes, and airport layouts with real-world runway sets.
 */

export interface AirlinePool {
  /** Radiotelephony callsign, e.g. "Speedbird". */
  telephony: string;
}

export const AIRLINES: readonly AirlinePool[] = [
  { telephony: 'Speedbird' },
  { telephony: 'Lufthansa' },
  { telephony: 'KLM' },
  { telephony: 'Air France' },
  { telephony: 'Emirates' },
  { telephony: 'Qatari' },
  { telephony: 'Turkish' },
  { telephony: 'Swiss' },
  { telephony: 'Austrian' },
  { telephony: 'Scandinavian' },
  { telephony: 'Iberia' },
  { telephony: 'Ryanair' },
  { telephony: 'Easy' },
  { telephony: 'Wizz Air' },
  { telephony: 'Delta' },
  { telephony: 'United' },
  { telephony: 'American' },
  { telephony: 'Southwest' },
  { telephony: 'JetBlue' },
  { telephony: 'Cactus' },
  { telephony: 'Alaska' },
  { telephony: 'FedEx' },
  { telephony: 'Giant' },
  { telephony: 'LOT' },
];

export type WakeCategory = 'L' | 'M' | 'H' | 'J';

export interface AircraftType {
  /** Name as spoken on frequency, e.g. "Boeing 737". */
  name: string;
  wake: WakeCategory;
  /** true for light GA piston types. */
  ga?: boolean;
}

export const AIRCRAFT_TYPES: readonly AircraftType[] = [
  { name: 'Boeing 737', wake: 'M' },
  { name: 'Airbus A320', wake: 'M' },
  { name: 'Airbus A321', wake: 'M' },
  { name: 'Embraer 175', wake: 'M' },
  { name: 'Embraer 190', wake: 'M' },
  { name: 'CRJ-900', wake: 'M' },
  { name: 'ATR 72', wake: 'M' },
  { name: 'Dash 8', wake: 'M' },
  { name: 'Boeing 757', wake: 'M' },
  { name: 'Boeing 777', wake: 'H' },
  { name: 'Boeing 787', wake: 'H' },
  { name: 'Airbus A330', wake: 'H' },
  { name: 'Airbus A350', wake: 'H' },
  { name: 'Boeing 747', wake: 'H' },
  { name: 'Airbus A380', wake: 'J' },
  { name: 'Cessna 172', wake: 'L', ga: true },
  { name: 'Cirrus SR22', wake: 'L', ga: true },
];

export const PHONETIC = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'X-ray', 'Yankee', 'Zulu',
] as const;

/** Invented (safe) 5-letter waypoint names for "proceed direct" clauses. */
export const FIXES = [
  'BARTO', 'KELSO', 'DENVO', 'MIRVA', 'TULSO', 'RONEX', 'SUMBA', 'PIKOL',
  'VEDRA', 'LOGAN', 'NORVO', 'ASKIL', 'TOBIX', 'GRENA', 'OKRIT', 'SELDO',
] as const;

/** A physical runway strip: two opposite-facing ends, e.g. 09L / 27R. */
export interface RunwayPair {
  a: string;
  b: string;
}

export interface AirportSpec {
  icao: string;
  /** Facility base name as spoken, e.g. "Heathrow". */
  name: string;
  /** Pressure phrasing: QNH hectopascals (ICAO) vs US altimeter inches. */
  pressureUnit: 'hPa' | 'inHg';
  pairs: readonly RunwayPair[];
  taxiways: readonly string[];
  tower: string;
  ground: string;
  approach: string;
  departure: string;
  center: string;
}

/**
 * Airports with their real runway sets (public knowledge), so every
 * session plays out on a coherent, believable field.
 */
export const AIRPORTS: readonly AirportSpec[] = [
  {
    icao: 'EGLL',
    name: 'Heathrow',
    pressureUnit: 'hPa',
    pairs: [
      { a: '09L', b: '27R' },
      { a: '09R', b: '27L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Echo', 'Lima', 'November', 'Sierra'],
    tower: 'Heathrow Tower',
    ground: 'Heathrow Ground',
    approach: 'Heathrow Director',
    departure: 'London Control',
    center: 'London Control',
  },
  {
    icao: 'KJFK',
    name: 'Kennedy',
    pressureUnit: 'inHg',
    pairs: [
      { a: '04L', b: '22R' },
      { a: '04R', b: '22L' },
      { a: '13L', b: '31R' },
      { a: '13R', b: '31L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Kilo', 'Papa'],
    tower: 'Kennedy Tower',
    ground: 'Kennedy Ground',
    approach: 'New York Approach',
    departure: 'New York Departure',
    center: 'New York Center',
  },
  {
    icao: 'KBOS',
    name: 'Boston',
    pressureUnit: 'inHg',
    pairs: [
      { a: '04L', b: '22R' },
      { a: '04R', b: '22L' },
      { a: '09', b: '27' },
      { a: '15R', b: '33L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Kilo', 'Mike', 'November'],
    tower: 'Boston Tower',
    ground: 'Boston Ground',
    approach: 'Boston Approach',
    departure: 'Boston Departure',
    center: 'Boston Center',
  },
  {
    icao: 'EHAM',
    name: 'Schiphol',
    pressureUnit: 'hPa',
    pairs: [
      { a: '18R', b: '36L' },
      { a: '18C', b: '36C' },
      { a: '06', b: '24' },
      { a: '09', b: '27' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Golf', 'Quebec', 'Victor', 'Zulu'],
    tower: 'Schiphol Tower',
    ground: 'Schiphol Ground',
    approach: 'Schiphol Approach',
    departure: 'Schiphol Departure',
    center: 'Amsterdam Radar',
  },
  {
    icao: 'EDDF',
    name: 'Frankfurt',
    pressureUnit: 'hPa',
    pairs: [
      { a: '07L', b: '25R' },
      { a: '07C', b: '25C' },
      { a: '07R', b: '25L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Lima', 'November', 'Sierra'],
    tower: 'Frankfurt Tower',
    ground: 'Frankfurt Ground',
    approach: 'Langen Radar',
    departure: 'Langen Radar',
    center: 'Rhein Radar',
  },
  {
    icao: 'KSFO',
    name: 'San Francisco',
    pressureUnit: 'inHg',
    pairs: [
      { a: '10L', b: '28R' },
      { a: '10R', b: '28L' },
      { a: '01L', b: '19R' },
      { a: '01R', b: '19L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Echo', 'Foxtrot', 'Mike', 'Zulu'],
    tower: 'San Francisco Tower',
    ground: 'San Francisco Ground',
    approach: 'NorCal Approach',
    departure: 'NorCal Departure',
    center: 'Oakland Center',
  },
  {
    icao: 'KORD',
    name: "O'Hare",
    pressureUnit: 'inHg',
    pairs: [
      { a: '10L', b: '28R' },
      { a: '10C', b: '28C' },
      { a: '09L', b: '27R' },
      { a: '09R', b: '27L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Hotel', 'Kilo', 'Tango', 'Whiskey'],
    tower: "O'Hare Tower",
    ground: "O'Hare Ground",
    approach: 'Chicago Approach',
    departure: 'Chicago Departure',
    center: 'Chicago Center',
  },
  {
    icao: 'LFPG',
    name: 'De Gaulle',
    pressureUnit: 'hPa',
    pairs: [
      { a: '08L', b: '26R' },
      { a: '08R', b: '26L' },
      { a: '09L', b: '27R' },
      { a: '09R', b: '27L' },
    ],
    taxiways: ['Alpha', 'Bravo', 'Delta', 'Echo', 'Quebec', 'Romeo', 'Tango'],
    tower: 'De Gaulle Tower',
    ground: 'De Gaulle Ground',
    approach: 'De Gaulle Approach',
    departure: 'De Gaulle Departure',
    center: 'Paris Control',
  },
];

/** Magnetic-ish heading of a runway end derived from its number. */
export function runwayHeading(rwy: string): number {
  const num = parseInt(rwy.replace(/[LCR]/g, ''), 10);
  return (num % 36) * 10 || 360;
}

/** Smallest absolute angular difference between two headings (0–180). */
export function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
