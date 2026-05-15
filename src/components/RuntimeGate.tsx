/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface RuntimeGateProps {
  /**
   * Optional feature name to display in the message.
   * e.g. "LiteRT models", "Perception analysis"
   */
  featureName?: string;
  /**
   * Optional custom error message. If not provided, the default empty state body from UI-SPEC is used.
   */
  message?: string;
  /**
   * Whether the gate is currently checking the runtime status.
   */
  isChecking?: boolean;
  /**
   * Optional callback to retry the runtime check.
   */
  onRetry?: () => void;
}

/**
 * RuntimeGate — blocks access to native-only features on unsupported platforms (Web, Expo Go, etc.)
 * Adheres strictly to .planning/phases/01-native-runtime-baseline/01-UI-SPEC.md
 */
export function RuntimeGate({ featureName, message, isChecking, onRetry }: RuntimeGateProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation('errors');

  const handleGoToModels = () => {
    router.navigate('/models' as never);
  };

  const isModelsScreen = pathname === '/models';

  const bodyText = message
    ?? (featureName
      ? t('runtime_gate_feature_specific', { featureName })
      : t('web_only_message'));

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ThemedText style={styles.heading}>{t('native_runtime_check')}</ThemedText>

        <ThemedText style={styles.body}>{bodyText}</ThemedText>

        <View style={styles.actions}>
          {!isModelsScreen && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleGoToModels}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('open_models')}
            >
              <ThemedText style={styles.primaryBtnText}>{t('open_models')}</ThemedText>
            </TouchableOpacity>
          )}

          {onRetry && (
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={onRetry}
              activeOpacity={0.8}
              disabled={isChecking}
              accessibilityRole="button"
              accessibilityLabel={t('retry_native_check')}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={theme.accentMutedText} />
              ) : (
                <ThemedText style={styles.ghostBtnText}>{t('retry_native_check')}</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.five, // xl (32px)
      paddingVertical: Spacing.five,
      backgroundColor: theme.background,
    },
    card: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: theme.surfaceWarning,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.warningBorder,
      padding: Spacing.three, // md (16px)
      gap: Spacing.two, // sm (8px)
    },
    heading: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20, // 1.25
    },
    body: {
      color: theme.warningText,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 21, // 1.5
    },
    actions: {
      marginTop: Spacing.one, // xs (4px)
      gap: Spacing.two,
    },
    primaryBtn: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 12,
      paddingVertical: 12, // Ensure 44px touch target
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: theme.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    ghostBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingVertical: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: {
      color: theme.accentMutedText,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
