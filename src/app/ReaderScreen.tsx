import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, GhostButton, PrimaryButton } from '../components/ui';
import { countWords } from '../core/textMetrics';
import { getDomain } from '../domains/registry';
import type { SpeakerRole } from '../domains/types';
import { signatureHistoryBridge } from '../store/historyStore';
import { domainSettingsSnapshot, useSettingsStore } from '../store/settingsStore';
import { Teleprompter, TeleprompterBlock } from '../teleprompter/Teleprompter';
import { autoSpeed, clampWpm, WPM_MAX, WPM_MIN } from '../teleprompter/useAutoSpeed';
import { colors, radius, spacing, type as t } from '../theme/tokens';
import type { ScreenProps } from './navigation';

/** The session target: the stream runs for about one minute. */
const TARGET_SECONDS = 60;
/** Generate a little extra so text can never run out before the minute. */
const GENERATE_SECONDS = 68;

type UiPhase = 'preparing' | 'countdown' | 'reading' | 'paused' | 'done';

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ReaderScreen({ navigation, route }: ScreenProps<'Reader'>) {
  const { domainId, level, wpm: startWpm, wpmIsAuto } = route.params;
  useKeepAwake();

  const scrollDirection = useSettingsStore((s) => s.scrollDirection);
  const hapticsOn = useSettingsStore((s) => s.haptics);
  const setWpmForLevel = useSettingsStore((s) => s.setWpmForLevel);

  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 2 ** 31));
  const [wpm, setWpm] = useState<number>(startWpm);
  const [phase, setPhase] = useState<UiPhase>('preparing');
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);

  const accumMsRef = useRef(0);
  const resumeTsRef = useRef(0);
  const autoTunedRef = useRef(false);

  const content = useMemo(() => {
    const domain = getDomain(domainId);
    const session = domain.createSession({
      level,
      seed,
      settings: domainSettingsSnapshot(),
      history: signatureHistoryBridge(),
    });
    const targetWords = Math.ceil((GENERATE_SECONDS / 60) * startWpm);
    const blocks: TeleprompterBlock[] = [];
    let words = 0;
    let i = 0;
    while ((words < targetWords || blocks.length < 8) && blocks.length < 300) {
      const txn = session.next();
      const w = countWords(txn.text);
      words += w;
      blocks.push({
        id: `${seed}-${i++}`,
        text: txn.text,
        words: w,
        role: (txn.meta?.role as SpeakerRole) ?? 'controller',
      });
    }
    return { blocks, totalWords: words, info: session.info?.() };
  }, [domainId, level, seed, startWpm]);

  // Auto-speed refinement (SPEC §7): once, from actual content density.
  useEffect(() => {
    if (wpmIsAuto && !autoTunedRef.current && content.blocks.length > 0) {
      autoTunedRef.current = true;
      setWpm(autoSpeed(startWpm, content.totalWords / content.blocks.length));
    }
  }, [content, startWpm, wpmIsAuto]);

  const buzz = (kind: 'tick' | 'go' | 'done') => {
    if (!hapticsOn) return;
    if (kind === 'tick') void Haptics.selectionAsync();
    if (kind === 'go') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (kind === 'done') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Countdown 3-2-1-GO once the teleprompter has measured its content.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      buzz('go');
      const id = setTimeout(() => {
        resumeTsRef.current = Date.now();
        setPhase('reading');
      }, 450);
      return () => clearTimeout(id);
    }
    buzz('tick');
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // Elapsed-time ticker while reading.
  useEffect(() => {
    if (phase !== 'reading') return;
    const id = setInterval(() => {
      setElapsedS((accumMsRef.current + (Date.now() - resumeTsRef.current)) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  const finish = () => {
    if (phase === 'reading') {
      accumMsRef.current += Date.now() - resumeTsRef.current;
    }
    setElapsedS(accumMsRef.current / 1000);
    setPhase('done');
    buzz('done');
  };

  const togglePause = () => {
    if (phase === 'reading') {
      accumMsRef.current += Date.now() - resumeTsRef.current;
      setPhase('paused');
    } else if (phase === 'paused') {
      resumeTsRef.current = Date.now();
      setPhase('reading');
    }
  };

  const restart = () => {
    accumMsRef.current = 0;
    autoTunedRef.current = true; // keep the user's current speed
    setElapsedS(0);
    setProgress(0);
    setCountdown(3);
    setPhase('preparing');
    setSeed(Math.floor(Math.random() * 2 ** 31));
  };

  const onReady = () => {
    setCountdown(3);
    setPhase((p) => (p === 'preparing' ? 'countdown' : p));
  };

  const onProgress = (f: number) => {
    setProgress(f);
    if (f >= 1) finish();
  };

  const avgWpm = elapsedS > 3 ? Math.round(content.totalWords / (elapsedS / 60)) : wpm;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.close}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          {content.info ? (
            <>
              <Text style={styles.headerTitle}>{content.info.title}</Text>
              {content.info.subtitle && (
                <Text style={styles.headerSubtitle}>{content.info.subtitle}</Text>
              )}
            </>
          ) : (
            <Text style={styles.headerTitle}>SpeakStream</Text>
          )}
        </View>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>{level}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>

      {/* Prompter */}
      <View style={styles.prompterWrap}>
        <Teleprompter
          blocks={content.blocks}
          wpm={wpm}
          running={phase === 'reading'}
          direction={scrollDirection}
          onReady={onReady}
          onProgress={onProgress}
        />

        {phase === 'countdown' && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.countdownNumber}>{countdown > 0 ? countdown : 'GO'}</Text>
          </View>
        )}

        {phase === 'done' && (
          <View style={[styles.overlay, styles.doneOverlay]}>
            <Card style={styles.doneCard}>
              <Text style={styles.doneTitle}>Session complete</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Time</Text>
                <Text style={styles.statValue}>{formatTime(elapsedS)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Words read</Text>
                <Text style={styles.statValue}>{content.totalWords}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Transmissions</Text>
                <Text style={styles.statValue}>{content.blocks.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average speed</Text>
                <Text style={styles.statValue}>{avgWpm} WPM</Text>
              </View>
              <PrimaryButton label="Read again" onPress={restart} style={{ marginTop: spacing.l }} />
              <GhostButton
                label="Home"
                onPress={() => navigation.goBack()}
                style={{ marginTop: spacing.s }}
              />
            </Card>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlsTopRow}>
          <Text style={styles.time}>
            {formatTime(elapsedS)} <Text style={styles.timeDim}>/ {formatTime(TARGET_SECONDS)}</Text>
          </Text>
          <Text style={styles.wpmValue}>
            {wpm} <Text style={styles.timeDim}>WPM</Text>
          </Text>
        </View>
        <Slider
          minimumValue={WPM_MIN}
          maximumValue={WPM_MAX}
          step={2}
          value={clampWpm(wpm)}
          onValueChange={(v) => setWpm(Math.round(v))}
          onSlidingComplete={(v) => setWpmForLevel(level, Math.round(v))}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.surfaceRaised}
          thumbTintColor={colors.accent}
        />
        <View style={styles.buttonRow}>
          <GhostButton label="Restart" onPress={restart} style={styles.flexBtn} />
          <PrimaryButton
            label={phase === 'paused' ? 'Resume' : 'Pause'}
            onPress={togglePause}
            style={styles.flexBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    gap: spacing.m,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { color: colors.textDim, fontSize: 16 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...t.body, color: colors.text, fontWeight: '700' },
  headerSubtitle: { ...t.small, color: colors.textDim, marginTop: 1 },
  levelChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 5,
  },
  levelChipText: { ...t.label, color: colors.accent },
  progressTrack: { height: 3, backgroundColor: colors.surface },
  progressFill: { height: 3, backgroundColor: colors.accent },
  prompterWrap: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: '800',
    color: colors.accent,
  },
  doneOverlay: { backgroundColor: 'rgba(11, 15, 23, 0.88)' },
  doneCard: { width: '86%', maxWidth: 420 },
  doneTitle: { ...t.title, color: colors.text, marginBottom: spacing.l, textAlign: 'center' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statLabel: { ...t.body, color: colors.textDim },
  statValue: { ...t.body, color: colors.text, fontWeight: '700' },
  controls: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.m,
    backgroundColor: colors.bg,
  },
  controlsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  time: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  timeDim: { ...t.small, color: colors.textDim, fontWeight: '500' },
  wpmValue: { fontSize: 22, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  buttonRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xs },
  flexBtn: { flex: 1 },
});
