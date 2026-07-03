import Slider from '@react-native-community/slider';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark, Wordmark } from '../components/Logo';
import { Card, Chip, PrimaryButton, SectionLabel } from '../components/ui';
import { DOMAINS, getDomain } from '../domains/registry';
import type { LevelId } from '../domains/types';
import { useSettingsStore } from '../store/settingsStore';
import { baseWpmFor, clampWpm, WPM_MAX, WPM_MIN } from '../teleprompter/useAutoSpeed';
import { colors, radius, spacing, type as t } from '../theme/tokens';
import type { ScreenProps } from './navigation';

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const lastLevel = useSettingsStore((s) => s.lastLevel);
  const wpmByLevel = useSettingsStore((s) => s.wpmByLevel);
  const setLastLevel = useSettingsStore((s) => s.setLastLevel);

  const domain = getDomain('atc');
  const [level, setLevel] = useState<LevelId>(lastLevel);
  const suggested = useMemo(() => baseWpmFor(domain.levels, level), [domain, level]);
  const [wpm, setWpm] = useState<number>(() => clampWpm(wpmByLevel[lastLevel] ?? suggested));

  const selectLevel = (id: LevelId) => {
    setLevel(id);
    setWpm(clampWpm(wpmByLevel[id] ?? baseWpmFor(domain.levels, id)));
  };

  const levelInfo = domain.levels.find((l) => l.id === level);
  const wpmIsAuto = wpm === suggested;

  const start = () => {
    setLastLevel(level);
    navigation.navigate('Reader', { domainId: domain.id, level, wpm, wpmIsAuto });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <LogoMark size={46} />
            <View style={{ marginLeft: spacing.m }}>
              <Wordmark size={25} />
              <Text style={styles.tagline}>Teleprompter reading trainer</Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.gear, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
        </View>

        <SectionLabel>Profession</SectionLabel>
        {DOMAINS.map((d) => {
          const selected = d.id === domain.id;
          return (
            <Pressable
              key={d.id}
              disabled={!d.available}
              style={[
                styles.domainCard,
                selected && d.available && styles.domainCardSelected,
                !d.available && styles.domainCardDisabled,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.domainName, !d.available && { color: colors.textFaint }]}>
                  {d.name}
                </Text>
                <Text style={styles.domainTagline}>{d.tagline}</Text>
              </View>
              {d.available ? (
                <View style={styles.activeDot} />
              ) : (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>SOON</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <SectionLabel>CEFR level</SectionLabel>
        <View style={styles.levelRow}>
          {domain.levels.map((l) => (
            <View key={l.id} style={{ flex: 1 }}>
              <Chip
                label={l.label}
                selected={l.id === level}
                onPress={() => selectLevel(l.id)}
              />
            </View>
          ))}
        </View>
        {levelInfo && <Text style={styles.levelDescription}>{levelInfo.description}</Text>}

        <SectionLabel>Speed</SectionLabel>
        <Card>
          <View style={styles.speedRow}>
            <Text style={styles.speedValue}>
              {wpm} <Text style={styles.speedUnit}>WPM</Text>
            </Text>
            {wpmIsAuto ? (
              <View style={styles.autoBadge}>
                <Text style={styles.autoText}>AUTO</Text>
              </View>
            ) : (
              <Pressable onPress={() => setWpm(suggested)} hitSlop={8}>
                <Text style={styles.resetText}>reset to {suggested}</Text>
              </Pressable>
            )}
          </View>
          <Slider
            minimumValue={WPM_MIN}
            maximumValue={WPM_MAX}
            step={2}
            value={wpm}
            onValueChange={(v) => setWpm(Math.round(v))}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.surfaceRaised}
            thumbTintColor={colors.accent}
          />
          <Text style={styles.speedHint}>
            Suggested for {level}: {suggested} WPM · adjustable live while reading
          </Text>
        </Card>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>≈ 1 minute session</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>100% offline</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>no account</Text>
        </View>

        <PrimaryButton label="Start reading" onPress={start} style={{ marginTop: spacing.l }} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.l },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  tagline: { ...t.small, color: colors.textDim, marginTop: 2 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gearIcon: { fontSize: 20, color: colors.textDim },
  domainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    marginBottom: spacing.s,
  },
  domainCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentFaint },
  domainCardDisabled: { opacity: 0.55 },
  domainName: { ...t.h2, color: colors.text },
  domainTagline: { ...t.small, color: colors.textDim, marginTop: 3 },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginLeft: spacing.m,
  },
  soonBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.m,
    paddingVertical: 4,
    marginLeft: spacing.m,
  },
  soonText: { ...t.label, color: colors.textFaint },
  levelRow: { flexDirection: 'row', gap: spacing.s },
  levelDescription: { ...t.small, color: colors.textDim, marginTop: spacing.s },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  speedValue: { fontSize: 30, fontWeight: '800', color: colors.text },
  speedUnit: { ...t.small, color: colors.textDim, fontWeight: '600' },
  autoBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 4,
  },
  autoText: { ...t.label, color: colors.accent },
  resetText: { ...t.small, color: colors.accent },
  speedHint: { ...t.small, color: colors.textDim, marginTop: spacing.xs },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.s,
  },
  metaText: { ...t.small, color: colors.textDim },
  metaDot: { color: colors.textFaint },
});
