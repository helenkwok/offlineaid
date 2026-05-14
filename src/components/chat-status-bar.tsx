/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * ChatStatusBar — a slim persistent strip sitting just above the input row.
 * Shows the loaded model name, active pack count, and RAG state at a glance
 * once a conversation is in progress.  When no model is loaded it becomes a
 * tappable prompt to navigate to the Models screen, keeping the action visible
 * without blocking the chat surface.
 *
 * The embedding model indicator is intentionally omitted: it currently has no
 * effect on retrieval (keyword FTS5 search only) and showing it creates false
 * signal about functionality that isn't wired up yet.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getModelShortName } from '@/models/runtime';

interface Props {
  modelLoaded: boolean;
  loadedModelId: string | null;
  activePackCount: number;
  ragOn: boolean;
  onTapNoModel: () => void;
}

export function ChatStatusBar({
  modelLoaded,
  loadedModelId,
  activePackCount,
  ragOn,
  onTapNoModel,
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!modelLoaded) {
    return (
      <TouchableOpacity style={styles.barWarning} onPress={onTapNoModel} activeOpacity={0.75}>
        <View style={[styles.dot, styles.dotOff]} />
        <Text style={styles.warningText}>No model. Tap to load one.</Text>
      </TouchableOpacity>
    );
  }

  const modelName = loadedModelId ? getModelShortName(loadedModelId) : 'No model';
  const packLabel =
    activePackCount === 0
      ? 'No packs'
      : `${activePackCount} pack${activePackCount === 1 ? '' : 's'}`;

  return (
    <View style={styles.bar}>
      <View style={[styles.dot, styles.dotOn]} />
      <Text style={styles.modelName} numberOfLines={1}>
        {modelName}
      </Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.label}>{packLabel}</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={[styles.label, ragOn ? styles.ragOn : styles.ragOff]}>
        {ragOn ? 'Sources on' : 'Sources off'}
      </Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
      gap: 6,
    },
    barWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.warningBorder,
      backgroundColor: theme.surfaceWarning,
      gap: 8,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      flexShrink: 0,
    },
    dotOn: {
      backgroundColor: theme.successBorder,
    },
    dotOff: {
      backgroundColor: theme.warningBorder,
    },
    modelName: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      flexShrink: 1,
    },
    sep: {
      color: theme.textMuted,
      fontSize: 12,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    warningText: {
      color: theme.warningText,
      fontSize: 12,
      fontWeight: '600',
    },
    ragOn: {
      color: theme.successText,
      fontWeight: '600',
    },
    ragOff: {
      color: theme.textMuted,
    },
  });
}
