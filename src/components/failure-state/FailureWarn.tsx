/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppTheme, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Action = { label: string; a11yLabel?: string; onPress: () => void };

// Tier 1 — recoverable advisory. Neutral surface, red ONLY on action.
// Structurally cannot accept a red primary action (no danger flag). The
// surface treatment is fixed; consumers cannot promote this to error tier.
export type FailureWarnProps = {
  icon?: '?' | '!' | '°';
  title: string;
  body: string;
  meta?: string;
  primary: Action;
  // Optional ghost+danger demoted action — used by no-chunk-matched to make
  // ungrounded generation a deliberate, demoted choice (text-only, red).
  ghostDanger?: Action;
  secondary?: Action;
  ghost?: Action;
};

export function FailureWarn({
  icon = '?',
  title,
  body,
  meta,
  primary,
  ghostDanger,
  secondary,
  ghost,
}: FailureWarnProps) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
      </View>

      <Text style={styles.body}>{body}</Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={primary.onPress}
          accessibilityRole="button"
          accessibilityLabel={primary.a11yLabel ?? primary.label}
        >
          <Text style={styles.primaryBtnText}>{primary.label}</Text>
        </Pressable>

        {ghostDanger && (
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            onPress={ghostDanger.onPress}
            accessibilityRole="button"
            accessibilityLabel={ghostDanger.a11yLabel ?? ghostDanger.label}
          >
            <Text style={styles.ghostDangerText}>{ghostDanger.label}</Text>
          </Pressable>
        )}

        {secondary && (
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={secondary.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondary.a11yLabel ?? secondary.label}
          >
            <Text style={styles.secondaryBtnText}>{secondary.label}</Text>
          </Pressable>
        )}

        {ghost && (
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            onPress={ghost.onPress}
            accessibilityRole="button"
            accessibilityLabel={ghost.a11yLabel ?? ghost.label}
          >
            <Text style={styles.ghostText}>{ghost.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    meta: {
      color: theme.textMuted,
      fontSize: 12,
    },
    body: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    // Neutral-primary: theme.text bg with backgroundElement text — high
    // contrast inversion, no red. This is the structural guard against a
    // red primary action on Tier 1.
    primaryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    primaryBtnText: {
      color: theme.backgroundElement,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: 'transparent',
    },
    secondaryBtnText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    ghostBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: 'transparent',
    },
    ghostText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    // Demoted-danger: text-only, red. Used when an ungrounded action must be
    // available but never the obvious choice.
    ghostDangerText: {
      color: theme.accentMutedText,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
