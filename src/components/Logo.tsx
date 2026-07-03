/**
 * SpeakStream logo — a teleprompter glyph: three scrolling text lines,
 * the middle one lit amber inside the focal band with a motion chevron.
 * Works from 24 px (header) up to app-icon size.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Rect
        x={2}
        y={2}
        width={92}
        height={92}
        rx={22}
        fill="#131A26"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={2}
      />
      <Rect x={12} y={38} width={72} height={22} rx={11} fill="rgba(255,180,84,0.16)" />
      <Rect x={26} y={20} width={44} height={7} rx={3.5} fill="#39455C" />
      <Rect x={18} y={45.5} width={48} height={7} rx={3.5} fill={colors.accent} />
      <Path d="M72 43 L81 49 L72 55 Z" fill={colors.accent} />
      <Rect x={30} y={71} width={36} height={7} rx={3.5} fill="#39455C" />
    </Svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.word, { fontSize: size }]}>
        Speak
        <Text style={styles.accent}>Stream</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { color: colors.text, fontWeight: '800', letterSpacing: 0.3 },
  accent: { color: colors.accent },
});
