/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCameraSession } from './use-camera-session';

export function LiveScanOverlay() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { state, permission, liveSnapshot, handleToggleLiveScan } = useCameraSession();
  const { t } = useTranslation('camera');

  if (state.selectedImage) {
    return null;
  }

  return (
    <View style={styles.notesCard}>
      <Text style={styles.notesTitle}>{t('live_cues_title')}</Text>
      <Text style={styles.notesBody}>{t('live_cues_body')}</Text>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            (!permission?.granted || !state.isCameraReady) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleToggleLiveScan}
          disabled={!permission?.granted || !state.isCameraReady}
          accessibilityRole="button"
          accessibilityLabel={state.liveScanEnabled ? t('pause_live_scan') : t('resume_live_scan')}>
          <Text style={styles.secondaryButtonText}>
            {state.liveScanEnabled ? t('pause_live_scan') : t('resume_live_scan')}
          </Text>
        </Pressable>
        <View style={styles.liveStatusChip}>
          <Text style={styles.liveStatusChipText}>
            {state.liveScanEnabled
              ? state.isLiveSampling
                ? t('live_status_sampling')
                : t('live_status_watching')
              : t('live_status_paused')}
          </Text>
        </View>
      </View>
      {state.liveScanError ? <Text style={styles.errorText}>{state.liveScanError}</Text> : null}
      {liveSnapshot ? (
        <View style={styles.analysisSection}>
          {liveSnapshot.ocrText ? (
            <>
              <Text style={styles.analysisHeading}>{t('live_ocr')}</Text>
              <Text style={styles.analysisBody}>
                {liveSnapshot.ocrText.length > 220
                  ? `${liveSnapshot.ocrText.slice(0, 219).trimEnd()}…`
                  : liveSnapshot.ocrText}
              </Text>
            </>
          ) : null}
          {liveSnapshot.barcodes.length > 0 ? (
            <>
              <Text style={styles.analysisHeading}>{t('live_barcodes')}</Text>
              {liveSnapshot.barcodes.map((barcode) => (
                <Text key={`${barcode.format}-${barcode.value}`} style={styles.analysisItem}>
                  • {barcode.format}: {barcode.value}
                </Text>
              ))}
            </>
          ) : null}
          {liveSnapshot.objects.length > 0 ? (
            <>
              <Text style={styles.analysisHeading}>{t('live_labels')}</Text>
              <Text style={styles.analysisBody}>
                {liveSnapshot.objects
                  .slice(0, 4)
                  .map((item) => item.label)
                  .join(', ')}
              </Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.analysisBody}>{t('live_scan_hint')}</Text>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    notesCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 10,
    },
    notesTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    notesBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    controls: {
      flexDirection: 'row',
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: Spacing.three,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    liveStatusChip: {
      minHeight: 48,
      minWidth: 112,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      backgroundColor: theme.surfaceInfo,
      borderWidth: 1,
      borderColor: theme.accentStrong,
    },
    liveStatusChipText: {
      color: theme.accentMutedText,
      fontSize: 12,
      fontWeight: '700',
    },
    analysisSection: {
      gap: 6,
    },
    analysisHeading: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    analysisBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    analysisItem: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    errorText: {
      color: theme.warningText,
      fontSize: 13,
      fontWeight: '600',
    },
    buttonPressed: {
      opacity: 0.84,
    },
    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.border,
    },
  });
}
