/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppTheme, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Action = { label: string; a11yLabel?: string; onPress: () => void };

export type FailureCriticalRow = { k: string; v: string; danger?: boolean };

// Tier 3 — model unusable, hard stop. ONLY screen-spanning red in the app.
// Action order is fixed: fallback (neutral, FIRST — lay-user safe path),
// repair (red, second — field-pro action), alt (bordered).
export type FailureCriticalProps = {
  stripText: string;
  title: string;
  body: string;
  rows: FailureCriticalRow[];
  fallback: Action;
  repair?: Action;
  alt?: Action;
};

// Module-level guard: assert only one FailureCritical is mounted at a time
// in dev. Tier 3 is the only screen-spanning red and must not stack.
let mountedCount = 0;

export function FailureCritical({
  stripText,
  title,
  body,
  rows,
  fallback,
  repair,
  alt,
}: FailureCriticalProps) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    mountedCount += 1;
    if (__DEV__ && mountedCount > 1) {
      console.warn(
        '[FailureCritical] More than one instance mounted; Tier 3 must not stack.'
      );
    }
    return () => {
      mountedCount -= 1;
    };
  }, []);

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.strip}>
        <Text style={styles.stripText}>{stripText}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.bodyText}>{body}</Text>

        <View style={styles.rows}>
          {rows.map((row, i) => (
            <View key={`${row.k}-${i}`} style={styles.row}>
              <Text style={styles.rowKey}>{row.k}</Text>
              <Text style={[styles.rowVal, row.danger && styles.rowValDanger]}>
                {row.v}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.fallbackBtn, pressed && styles.pressed]}
            onPress={fallback.onPress}
            accessibilityRole="button"
            accessibilityLabel={fallback.a11yLabel ?? fallback.label}
          >
            <Text style={styles.fallbackBtnText}>{fallback.label}</Text>
          </Pressable>

          {repair && (
            <Pressable
              style={({ pressed }) => [styles.repairBtn, pressed && styles.pressed]}
              onPress={repair.onPress}
              accessibilityRole="button"
              accessibilityLabel={repair.a11yLabel ?? repair.label}
            >
              <Text style={styles.repairBtnText}>{repair.label}</Text>
            </Pressable>
          )}

          {alt && (
            <Pressable
              style={({ pressed }) => [styles.altBtn, pressed && styles.pressed]}
              onPress={alt.onPress}
              accessibilityRole="button"
              accessibilityLabel={alt.a11yLabel ?? alt.label}
            >
              <Text style={styles.altBtnText}>{alt.label}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundElement,
    },
    strip: {
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    stripText: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    body: {
      padding: Spacing.three,
      gap: Spacing.two,
      backgroundColor: theme.backgroundElement,
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    bodyText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    rows: {
      marginTop: Spacing.one,
      gap: 4,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.two,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 8,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    rowKey: {
      color: theme.textMuted,
      fontSize: 12,
      fontFamily: Fonts.mono,
      minWidth: 96,
      maxWidth: '40%',
    },
    rowVal: {
      color: theme.text,
      fontSize: 12,
      fontFamily: Fonts.mono,
      flex: 1,
    },
    rowValDanger: {
      color: theme.accentMutedText,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
      marginTop: Spacing.two,
    },
    // FIRST position: neutral-primary (lay-user safe path).
    fallbackBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    fallbackBtnText: {
      color: theme.backgroundElement,
      fontSize: 14,
      fontWeight: '700',
    },
    // SECOND position: red-600 fill (field-pro repair).
    repairBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.buttonPrimary,
    },
    repairBtnText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '700',
    },
    // THIRD position: bordered secondary.
    altBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: 'transparent',
    },
    altBtnText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
