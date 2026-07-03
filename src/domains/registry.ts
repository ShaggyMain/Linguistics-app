/**
 * Domain registry. Adding a future profession (phase 2/3) means adding
 * one module that satisfies `Domain` and listing it here — no changes
 * to the teleprompter or the screens.
 */

import { atcDomain } from './atc';
import type { Domain } from './types';

const comingSoon = (id: string, name: string, tagline: string): Domain => ({
  id,
  name,
  tagline,
  available: false,
  levels: [],
  createSession: () => {
    throw new Error(`Domain "${id}" is not available yet`);
  },
});

export const DOMAINS: readonly Domain[] = [
  atcDomain,
  comingSoon('journalist', 'TV News Reporter', 'Broadcast-style bulletins and headlines'),
  comingSoon('lawyer', 'Lawyer', 'Courtroom statements and legal briefs'),
];

export function getDomain(id: string): Domain {
  const domain = DOMAINS.find((d) => d.id === id);
  if (!domain) throw new Error(`Unknown domain: ${id}`);
  return domain;
}
