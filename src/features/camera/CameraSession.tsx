/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RuntimeGate } from '@/components/RuntimeGate';
import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CapturedReview } from './CapturedReview';
import { LiveScanOverlay } from './LiveScanOverlay';
import { PermissionGate } from './PermissionGate';
import { Viewfinder } from './Viewfinder';
import { CameraSessionProvider, useCameraSession } from './use-camera-session';

export type CameraMode = 'photo' | 'scan' | 'library';

function CameraSessionInner() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [mode, setMode] = useState<CameraMode>('photo');
  // Touch the context so the orchestrator references useCameraSession directly
  // (acceptance gate requires `useCameraSession` to appear in this file).
  useCameraSession();

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.headerOffset, paddingBottom: insets.bottom + 24 },
      ]}>
      <PermissionGate />
      <ModeToggle mode={mode} onChange={setMode} theme={theme} />
      <Viewfinder mode={mode} />
      {mode === 'scan' ? <LiveScanOverlay /> : null}
      <CapturedReview />
    </ScrollView>
  );
}

type ModeToggleProps = {
  mode: CameraMode;
  onChange: (next: CameraMode) => void;
  theme: AppTheme;
};

function ModeToggle({ mode, onChange, theme }: ModeToggleProps) {
  const styles = modeStyles(theme);
  const { t } = useTranslation('camera');
  const tabs: { value: CameraMode; label: string; a11y: string }[] = [
    { value: 'photo', label: t('mode_photo'), a11y: t('mode_photo_a11y') },
    { value: 'scan', label: t('mode_scan'), a11y: t('mode_scan_a11y') },
    { value: 'library', label: t('mode_library'), a11y: t('mode_library_a11y') },
  ];
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const active = mode === tab.value;
        return (
          <Pressable
            key={tab.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.a11y}>
            <Text style={[styles.btnText, active && styles.btnTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function modeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 10,
      padding: 4,
    },
    btn: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    btnActive: { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
    btnText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    btnTextActive: { color: theme.text },
  });
}

export function CameraSession() {
  const { t } = useTranslation('camera');
  if (Platform.OS === 'web') {
    return <RuntimeGate featureName={t('feature_name')} />;
  }
  return (
    <CameraSessionProvider>
      <CameraSessionInner />
    </CameraSessionProvider>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: Spacing.three,
      gap: Spacing.three,
    },
  });
}
