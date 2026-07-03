/** Small shared UI primitives (Radar Night styling). */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type as t } from '../theme/tokens';

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          selected && styles.chipLabelSelected,
          disabled && styles.chipLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primary, style, pressed && styles.pressed]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, style, pressed && styles.pressed]}
    >
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...t.label,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: spacing.s,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.l,
  },
  chip: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipDisabled: { opacity: 0.45 },
  chipLabel: { ...t.body, color: colors.textDim, fontWeight: '600' },
  chipLabelSelected: { color: colors.accent },
  chipLabelDisabled: { color: colors.textFaint },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.l,
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  primaryLabel: { ...t.h2, color: colors.onAccent },
  ghost: {
    borderRadius: radius.l,
    paddingVertical: spacing.l,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghostLabel: { ...t.h2, color: colors.text },
  pressed: { opacity: 0.75 },
});
