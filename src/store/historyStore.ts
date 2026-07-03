import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SignatureHistory } from '../domains/types';

const WINDOW = 50;

interface HistoryState {
  /** Rolling window of transmission signatures, persisted across sessions. */
  signatures: string[];
  push(sig: string): void;
  has(sig: string): boolean;
  reset(): void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      signatures: [],
      push: (sig) =>
        set((s) => ({
          signatures: [...s.signatures, sig].slice(-WINDOW),
        })),
      has: (sig) => get().signatures.includes(sig),
      reset: () => set({ signatures: [] }),
    }),
    {
      name: 'speakstream.history.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Adapter handed to `Domain.createSession` — keeps domains store-agnostic. */
export function signatureHistoryBridge(): SignatureHistory {
  return {
    has: (sig) => useHistoryStore.getState().has(sig),
    push: (sig) => useHistoryStore.getState().push(sig),
  };
}
