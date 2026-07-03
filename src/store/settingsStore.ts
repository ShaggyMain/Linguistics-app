import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DomainSettings, LevelId } from '../domains/types';

export type ScrollDirection = 'up' | 'down';

interface SettingsState {
  /** Classic teleprompter: text enters from the bottom and travels up. */
  scrollDirection: ScrollDirection;
  numberReadout: DomainSettings['numberReadout'];
  pilotReadbacks: boolean;
  facilityBias: DomainSettings['facilityBias'];
  haptics: boolean;
  lastLevel: LevelId;
  /** Last WPM chosen per level (falls back to the level suggestion). */
  wpmByLevel: Partial<Record<LevelId, number>>;

  setScrollDirection(dir: ScrollDirection): void;
  setNumberReadout(mode: DomainSettings['numberReadout']): void;
  setPilotReadbacks(on: boolean): void;
  setFacilityBias(bias: DomainSettings['facilityBias']): void;
  setHaptics(on: boolean): void;
  setLastLevel(level: LevelId): void;
  setWpmForLevel(level: LevelId, wpm: number): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      scrollDirection: 'up',
      numberReadout: 'auto',
      pilotReadbacks: false,
      facilityBias: 'towerGround',
      haptics: true,
      lastLevel: 'B1',
      wpmByLevel: {},

      setScrollDirection: (scrollDirection) => set({ scrollDirection }),
      setNumberReadout: (numberReadout) => set({ numberReadout }),
      setPilotReadbacks: (pilotReadbacks) => set({ pilotReadbacks }),
      setFacilityBias: (facilityBias) => set({ facilityBias }),
      setHaptics: (haptics) => set({ haptics }),
      setLastLevel: (lastLevel) => set({ lastLevel }),
      setWpmForLevel: (level, wpm) =>
        set((s) => ({ wpmByLevel: { ...s.wpmByLevel, [level]: wpm } })),
    }),
    {
      name: 'speakstream.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Domain-facing view of the persisted settings. */
export function domainSettingsSnapshot(): DomainSettings {
  const s = useSettingsStore.getState();
  return {
    numberReadout: s.numberReadout,
    pilotReadbacks: s.pilotReadbacks,
    facilityBias: s.facilityBias,
  };
}
