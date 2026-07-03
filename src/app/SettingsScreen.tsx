import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, SectionLabel } from '../components/ui';
import { useHistoryStore } from '../store/historyStore';
import { useSettingsStore } from '../store/settingsStore';
import { colors, radius, spacing, type as t } from '../theme/tokens';
import type { ScreenProps } from './navigation';

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => (
        <View key={o.value} style={{ flex: 1 }}>
          <Chip label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        </View>
      ))}
    </View>
  );
}

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const s = useSettingsStore();
  const resetHistory = useHistoryStore((h) => h.reset);
  const historyCount = useHistoryStore((h) => h.signatures.length);

  const confirmReset = () => {
    Alert.alert(
      'Reset phrase history?',
      'The anti-repetition memory of recent transmissions will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetHistory },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionLabel>Teleprompter</SectionLabel>
        <Card>
          <Text style={styles.rowLabel}>Scroll direction</Text>
          <Segmented
            options={[
              { value: 'up', label: 'Upward (classic)' },
              { value: 'down', label: 'Downward' },
            ]}
            value={s.scrollDirection}
            onChange={s.setScrollDirection}
          />
          <Text style={styles.hint}>
            Classic prompter: text enters from the bottom and rises through the reading band.
          </Text>
        </Card>

        <SectionLabel>ATC stream</SectionLabel>
        <Card>
          <Text style={styles.rowLabel}>Number readout</Text>
          <Segmented
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'digits', label: 'Digits' },
              { value: 'aviation', label: 'Spelled' },
            ]}
            value={s.numberReadout}
            onChange={s.setNumberReadout}
          />
          <Text style={styles.hint}>
            Auto: digits up to C1, spelled aviation words ("three one zero") at C2.
          </Text>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: spacing.m }}>
              <Text style={styles.rowLabel}>Pilot readbacks</Text>
              <Text style={styles.hint}>Adds the pilot's reply line after each instruction.</Text>
            </View>
            <Switch
              value={s.pilotReadbacks}
              onValueChange={s.setPilotReadbacks}
              trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.rowLabel}>Frequency mix</Text>
          <Segmented
            options={[
              { value: 'towerGround', label: 'Tower & Ground' },
              { value: 'approachCenter', label: 'Approach & Center' },
            ]}
            value={s.facilityBias}
            onChange={s.setFacilityBias}
          />
          <Text style={styles.hint}>
            Tower & Ground favours runway and taxi calls; Approach & Center favours vectors and
            level changes.
          </Text>
        </Card>

        <SectionLabel>Feedback</SectionLabel>
        <Card>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: spacing.m }}>
              <Text style={styles.rowLabel}>Haptics</Text>
              <Text style={styles.hint}>Countdown ticks and session-complete feedback.</Text>
            </View>
            <Switch
              value={s.haptics}
              onValueChange={s.setHaptics}
              trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </Card>

        <SectionLabel>Data</SectionLabel>
        <Card>
          <Pressable onPress={confirmReset} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Text style={styles.dangerLabel}>Reset phrase history</Text>
            <Text style={styles.hint}>
              {historyCount} recent transmission signatures stored on this device.
            </Text>
          </Pressable>
        </Card>

        <SectionLabel>About</SectionLabel>
        <Card>
          <Text style={styles.aboutName}>SpeakStream</Text>
          <Text style={styles.hint}>
            Teleprompter fluency trainer for professional English. Everything is generated on your
            device — 100% offline, no account, no data collection.
          </Text>
        </Card>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.textDim, fontSize: 24, marginTop: -2 },
  title: { ...t.h2, color: colors.text },
  scroll: { paddingHorizontal: spacing.xl },
  rowLabel: { ...t.body, color: colors.text, fontWeight: '600', marginBottom: spacing.s },
  hint: { ...t.small, color: colors.textDim, marginTop: spacing.s },
  segRow: { flexDirection: 'row', gap: spacing.s },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.l,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  dangerLabel: { ...t.body, color: colors.danger, fontWeight: '600' },
  aboutName: { ...t.h2, color: colors.text, marginBottom: spacing.xs },
});
