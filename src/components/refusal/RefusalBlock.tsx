/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * RefusalBlock:error-rung surface that replaces the assistant bubble when
 * retrieval returns zero chunks. Authored copy from refusalCopy.ts (NEVER
 * generated). Reversed action hierarchy per 11-DESIGN-BRIEF rev 6 section 7:
 * the lay-user-safe path "Browse packs" is leftmost / primary neutral; the
 * dangerous "Answer without a source" affordance is ghost + danger text only,
 * never red-filled. Leading icon defaults to `exclamationmark.circle` per
 * brief section 6 line 55 anti-cliche rule (NOT `.triangle.fill`).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import type { RefusalKind } from '@/components/readiness/types';
import { severityStyle } from '@/components/severity/severityStyle';
import { REFUSAL_COPY } from '@/constants/refusalCopy';

export interface RefusalBlockProps {
  kind: RefusalKind;
  onBrowsePacks: () => void;
  onAnswerAnyway: () => void;
  onCancel: () => void;
  onOpenModels?: () => void;
}

export function RefusalBlock({
  kind,
  onBrowsePacks,
  onAnswerAnyway,
  onCancel,
  onOpenModels,
}: RefusalBlockProps) {
  const theme = useTheme();
  const hcBorderWidth = useBorderWidth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sev = severityStyle('error');
  const { t } = useTranslation('errors');
  const { t: tCommon } = useTranslation('common');
  // SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 sections 3 + 6 (11-10 Task 3): the rung
  // border (1.5 for 'error') is amplified to >=2 under HC/Sunlight without
  // collapsing the inter-rung delta. severityStyle.ts itself stays pure.
  const effectiveBorderWidth = Math.max(sev.borderWidth, hcBorderWidth);
  const text = REFUSAL_COPY(kind);

  const handleAnswerAnyway = useCallback(() => {
    Alert.alert(
      t('answer_without_source_dialog'),
      t('answer_without_source_body'),
      [
        { text: tCommon('cancel'), style: 'cancel' },
        { text: t('answer_anyway'), style: 'destructive', onPress: onAnswerAnyway },
      ]
    );
  }, [onAnswerAnyway, t, tCommon]);

  return (
    <View
      style={[
        styles.container,
        {
          borderWidth: effectiveBorderWidth,
          paddingVertical: sev.paddingV + 4,
          paddingHorizontal: sev.paddingH + 2,
        },
      ]}
      accessibilityRole="alert"
      testID={`refusal-block-${kind.kind}`}>
      <View style={styles.headerRow}>
        <SymbolView
          name="exclamationmark.circle"
          size={18}
          tintColor={theme.accent}
        />
        <Text
          style={[
            styles.body,
            {
              fontWeight: sev.fontWeight,
              letterSpacing: sev.letterSpacing,
            },
          ]}>
          {text.body}
        </Text>
      </View>
      {text.subBody ? <Text style={styles.subBody}>{text.subBody}</Text> : null}

      {kind.kind === 'model-not-loaded' ? (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={onOpenModels ?? onBrowsePacks}
            testID="refusal-action-open-models">
            <Text style={styles.primaryBtnText}>{t('open_models')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={onBrowsePacks}
            testID="refusal-action-browse">
            <Text style={styles.primaryBtnText}>{t('browse_packs')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostDangerBtn, pressed && styles.btnPressed]}
            onPress={handleAnswerAnyway}
            testID="refusal-action-answer-anyway">
            <Text style={styles.ghostDangerText}>{t('answer_without_source_button')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
            onPress={onCancel}
            testID="refusal-action-cancel">
            <Text style={styles.ghostText}>{tCommon('cancel')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      maxWidth: '94%',
      borderRadius: 12,
      backgroundColor: theme.surfaceAccent,
      borderColor: theme.accent,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    body: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
    },
    subBody: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      marginLeft: 26,
      marginTop: -4,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    // Primary neutral: leftmost, full-text label. Background is the user's
    // text color (high contrast, neutral). NOT red. Lay-user-safe path.
    primaryBtn: {
      backgroundColor: theme.text,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    primaryBtnText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '600',
    },
    // Ghost + danger: NO fill, NO border. Only `accentMutedText` text color
    // signals "this is the dangerous path". Reversed-hierarchy invariant per
    // brief section 7 + plan task 3.
    ghostDangerBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: 'transparent',
    },
    ghostDangerText: {
      color: theme.accentMutedText,
      fontSize: 13,
      fontWeight: '500',
    },
    ghostBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: 'transparent',
    },
    ghostText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    btnPressed: {
      opacity: 0.7,
    },
  });
}
