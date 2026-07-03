/**
 * Constant-speed vertical teleprompter.
 *
 * A reanimated `useFrameCallback` advances a translateY offset by
 * `pxPerSec * dt` every frame, so speed is perfectly linear and can be
 * changed live (WPM slider) without a hitch. The focal band marks the
 * "read now" zone; the top/bottom edges fade into the background like
 * a broadcast prompter.
 *
 * Direction 'up' is the classic prompter (text enters from the bottom
 * and travels upward). Direction 'down' renders blocks in reverse and
 * mirrors the motion, so reading order is preserved.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { colors, spacing, type as t } from '../theme/tokens';

export interface TeleprompterBlock {
  id: string;
  text: string;
  role: 'controller' | 'pilot' | 'broadcast';
  words: number;
}

interface TeleprompterProps {
  blocks: TeleprompterBlock[];
  /** Live reading speed in words per minute. */
  wpm: number;
  /** True while the prompter should be moving. */
  running: boolean;
  direction: 'up' | 'down';
  /** Fired once per content generation when everything is measured. */
  onReady?: () => void;
  /** Progress fraction 0..1 (throttled). */
  onProgress?: (fraction: number) => void;
}

/** Fraction of the viewport height where the focal band starts. */
const FOCAL_TOP = 0.38;
/** Focal band height ≈ three reading lines. */
const BAND_HEIGHT = t.reader.lineHeight * 3 + spacing.l;
/** Gap between the band top and the first line at start. */
const START_GAP = 20;

export function Teleprompter({
  blocks,
  wpm,
  running,
  direction,
  onReady,
  onProgress,
}: TeleprompterProps) {
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const totalWords = useMemo(
    () => blocks.reduce((sum, b) => sum + b.words, 0),
    [blocks],
  );
  const generation = useMemo(() => blocks.map((b) => b.id).join('|'), [blocks]);

  const offset = useSharedValue(0);
  const pxPerSec = useSharedValue(0);
  const runningSv = useSharedValue(false);
  const travel = useSharedValue(0);
  const lastReported = useSharedValue(0);

  // Reset motion whenever a new content generation arrives.
  useEffect(() => {
    offset.value = 0;
    lastReported.value = 0;
    setContentH(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  const ready = viewportH > 0 && contentH > 0 && totalWords > 0;

  // WPM → px/s using the measured words-per-pixel density of the content.
  useEffect(() => {
    pxPerSec.value = ready ? (wpm / 60) * (contentH / totalWords) : 0;
  }, [wpm, ready, contentH, totalWords, pxPerSec]);

  useEffect(() => {
    runningSv.value = running && ready;
  }, [running, ready, runningSv]);

  useEffect(() => {
    travel.value = ready ? contentH + START_GAP + BAND_HEIGHT * 0.6 : 0;
  }, [ready, contentH, travel]);

  useEffect(() => {
    if (ready) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, generation]);

  const reportProgress = (fraction: number) => {
    onProgress?.(fraction);
  };

  useFrameCallback((frame) => {
    'worklet';
    if (!runningSv.value || travel.value <= 0 || pxPerSec.value <= 0) return;
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;
    const next = Math.min(offset.value + pxPerSec.value * dt, travel.value);
    offset.value = next;
    const fraction = next / travel.value;
    if (fraction - lastReported.value >= 0.004 || fraction >= 1) {
      if (fraction > lastReported.value) {
        lastReported.value = fraction;
        runOnJS(reportProgress)(fraction);
      }
    }
  });

  const focalTop = viewportH * FOCAL_TOP;

  const contentStyle = useAnimatedStyle(() => {
    const base =
      direction === 'up'
        ? focalTop + START_GAP - offset.value
        : focalTop + START_GAP - contentH + offset.value;
    return { transform: [{ translateY: base }] };
  }, [direction, focalTop, contentH]);

  const ordered = direction === 'down' ? [...blocks].reverse() : blocks;
  const fadeHeight = Math.max(viewportH * 0.2, 80);

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
    >
      {/* Focal reading band (under the text). */}
      {viewportH > 0 && (
        <View
          pointerEvents="none"
          style={[styles.band, { top: focalTop, height: BAND_HEIGHT }]}
        />
      )}

      <Animated.View
        style={[styles.content, contentStyle, { opacity: ready ? 1 : 0 }]}
        onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
      >
        {ordered.map((block) => (
          <Text
            key={block.id}
            style={[
              styles.line,
              block.role === 'pilot' && styles.pilotLine,
              block.role === 'broadcast' && styles.broadcastLine,
            ]}
          >
            {block.text}
          </Text>
        ))}
      </Animated.View>

      {/* Edge fades (over the text). */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.bg, `${colors.bg}00`]}
        style={[styles.fade, { top: 0, height: fadeHeight }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.bg}00`, colors.bg]}
        style={[styles.fade, { bottom: 0, height: fadeHeight }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
  },
  line: {
    color: colors.text,
    fontSize: t.reader.fontSize,
    lineHeight: t.reader.lineHeight,
    fontWeight: t.reader.fontWeight,
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  pilotLine: {
    color: colors.pilot,
    fontSize: t.readerPilot.fontSize,
    lineHeight: t.readerPilot.lineHeight,
    fontWeight: t.readerPilot.fontWeight,
    fontStyle: 'italic',
  },
  broadcastLine: {
    color: colors.accent,
  },
  band: {
    position: 'absolute',
    left: spacing.m,
    right: spacing.m,
    backgroundColor: colors.accentFaint,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 180, 84, 0.28)',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
