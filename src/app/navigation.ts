import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LevelId } from '../domains/types';

export type RootStackParamList = {
  Home: undefined;
  Reader: {
    domainId: string;
    level: LevelId;
    wpm: number;
    /** True when the user kept the auto-suggested speed untouched. */
    wpmIsAuto: boolean;
  };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
