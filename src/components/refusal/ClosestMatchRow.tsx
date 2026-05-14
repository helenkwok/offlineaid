/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * ClosestMatchRow:collapsed/expandable row appended to RefusalBlock when
 * usePreferencesStore.suggestClosestPackOnRefusals === true. Wraps
 * useClosestMatch (stricter-threshold retrieval). Per 11-DESIGN-BRIEF rev 6
 * section 7: NEVER falls back to a low-confidence guess. If empty, renders
 * nothing.
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { useClosestMatch, type ClosestMatchState } from '@/hooks/useClosestMatch';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { usePackStore } from '@/store';

export interface ClosestMatchRowProps {
  query: string;
  // Optional pre-resolved state for callers that already host the resolution
  // (chat screen does this to share state with the no-flicker render gate).
  preResolved?: ClosestMatchState;
}

export function ClosestMatchRow({ query, preResolved }: ClosestMatchRowProps) {
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const styles = useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);
  const reducedMotion = useReducedMotionPref();
  const activePacks = usePackStore((s) => s.activePacks);
  const localState = useClosestMatch(query, preResolved ? [] : activePacks);
  const state = preResolved ?? localState;
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation('errors');

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  if (state.state === 'idle' || state.state === 'loading') {
    return (
      <View style={styles.skeleton} testID="closest-match-skeleton">
        <Animated.View
          style={[
            styles.skeletonInner,
            { opacity: reducedMotion ? 0.6 : 0.85 },
          ]}
        />
        <Text style={styles.skeletonText}>{t('closest_searching')}</Text>
      </View>
    );
  }

  if (state.state === 'empty') {
    return null;
  }

  return (
    <View style={styles.container} testID="closest-match-row">
      <Pressable
        onPress={toggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? t('closest_collapse_a11y') : t('closest_expand_a11y')
        }>
        <Text style={styles.pillText}>
          {expanded ? `${t('closest_match_label')} ▾` : `${t('closest_match_label')} ▸`}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.expanded}>
          <Text style={styles.chunkText}>{state.chunk}</Text>
          <View style={styles.sourceChip}>
            <SymbolView
              name="doc.text"
              size={11}
              tintColor={theme.textSecondary}
            />
            <Text style={styles.sourceChipText} numberOfLines={1}>
              {t('closest_source_paraphrased', { source: state.source })}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  // SUNLIGHT-1 (11-10 Task 3): pill / expanded / sourceChip / skeleton borders
  // all opt into useBorderWidth() so they thicken under HC/Sunlight.
  return StyleSheet.create({
    container: {
      marginTop: 8,
      gap: 6,
    },
    pill: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceMuted,
      borderWidth,
      borderColor: theme.border,
    },
    pressed: { opacity: 0.7 },
    pillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    expanded: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.surfaceMuted,
      borderWidth,
      borderColor: theme.border,
      gap: 8,
    },
    chunkText: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 19,
    },
    sourceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 6,
      backgroundColor: theme.surfaceAccent,
      borderWidth,
      borderColor: theme.border,
    },
    sourceChipText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      maxWidth: 240,
    },
    skeleton: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.surfaceMuted,
      borderWidth,
      borderColor: theme.border,
    },
    skeletonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.textMuted,
    },
    skeletonText: {
      color: theme.textMuted,
      fontSize: 12,
    },
  });
}
