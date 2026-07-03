/**
 * Domain contract — the plug-in boundary for professions (ATC now,
 * journalist / lawyer later). The core app and the teleprompter know
 * nothing about a domain beyond this file.
 */

export type LevelId = 'B1' | 'B2' | 'C1' | 'C2';

export interface Level {
  id: LevelId;
  label: string;
  /** Short human description shown in the level picker. */
  description: string;
  /** Starting speed suggestion; the live slider can override it. */
  suggestedWpm: number;
}

export type SpeakerRole = 'controller' | 'pilot' | 'broadcast';

export interface Transmission {
  /** One or more display-ready lines. */
  text: string;
  meta?: {
    /** Stable id of the template / clause combo that produced the text. */
    templateKey?: string;
    category?: string;
    callsign?: string;
    phase?: string;
    role?: SpeakerRole;
    /** Number of distinct instructions packed into this transmission. */
    instructions?: number;
    signature?: string;
    [key: string]: unknown;
  };
}

export interface Session {
  /** Returns the next fragment of the (conceptually infinite) stream. */
  next(): Transmission;
  /** Optional one-line context for the reader header (e.g. airport/ATIS). */
  info?(): { title: string; subtitle?: string };
}

/** Bridge to persisted anti-repetition history (AsyncStorage-backed in the app). */
export interface SignatureHistory {
  has(signature: string): boolean;
  push(signature: string): void;
}

export interface DomainSettings {
  /** 'auto' resolves per level (digits for B1–C1, aviation words for C2). */
  numberReadout: 'auto' | 'digits' | 'aviation';
  /** Append pilot readback lines after controller transmissions. */
  pilotReadbacks: boolean;
  /** Which facilities dominate the stream. */
  facilityBias: 'towerGround' | 'approachCenter';
}

export const DEFAULT_DOMAIN_SETTINGS: DomainSettings = {
  numberReadout: 'auto',
  pilotReadbacks: false,
  facilityBias: 'towerGround',
};

export interface SessionOptions {
  level: LevelId;
  seed?: number;
  settings?: Partial<DomainSettings>;
  history?: SignatureHistory;
}

export interface Domain {
  id: string;
  name: string;
  /** One-liner shown on the domain card. */
  tagline: string;
  /** false → rendered as a greyed-out "coming soon" card. */
  available: boolean;
  levels: Level[];
  createSession(opts: SessionOptions): Session;
}
