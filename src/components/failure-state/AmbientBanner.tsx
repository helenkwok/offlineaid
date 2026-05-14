/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppTheme, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useReducedMotion } from './use-reduced-motion';

type Action = { label: string; a11yLabel?: string; onPress: () => void };

// NOT a failure tier — system state. Neutral surface, NEVER red. Pulsing dot
// gates on prefers-reduced-motion. Mounts at top of (index)/_layout.tsx so it
// persists across tabs without blocking interaction.
export type AmbientBannerProps = {
  message: string;
  progress?: { current: number; total: number; unit: string };
  eta?: string;
  actions?: Action[];
};

export function AmbientBanner({ message, progress, eta, actions }: AmbientBannerProps) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  const progressText = progress
    ? `${progress.current} / ${progress.total} ${progress.unit}${eta ? ` · ${eta}` : ''}`
    : eta
      ? eta
      : null;

  return (
    <View style={styles.bar} accessibilityRole="progressbar">
      <Animated.View style={[styles.dot, { opacity }]} />
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      {progressText && (
        <Text style={styles.progress} numberOfLines={1}>
          {progressText}
        </Text>
      )}
      {actions?.map((a, i) => (
        <Pressable
          key={`${a.label}-${i}`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.a11yLabel ?? a.label}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={styles.actionText}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      backgroundColor: theme.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.textMuted,
    },
    message: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
    },
    progress: {
      color: theme.textMuted,
      fontSize: 12,
      fontFamily: Fonts.mono,
      marginLeft: 'auto',
    },
    action: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: 'transparent',
    },
    actionText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
