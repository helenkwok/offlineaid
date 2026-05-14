/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from 'react';
import { Appearance, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppTheme } from '@/constants/theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { useTheme } from '@/hooks/use-theme';
import { usePreferencesStore, useThemeTransitionStore } from '@/store';

// SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 7 + section 11.
//
// Soft auto-switch dialog. Surfaces only when the user toggled Sunlight Mode
// from false to true while the active resolved scheme is Dark, AND
// sunlightAutoSwitchDontAskAgain is false. The Settings > Display screen
// owns the trigger logic; this component is presentational.
//
// Reduced-motion gating: when useReducedMotionPref() is true, the modal
// uses animationType="none" (instant). Otherwise the RN default 200ms fade.

export interface SunlightAutoSwitchDialogProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function SunlightAutoSwitchDialog({
  visible,
  onDismiss,
}: SunlightAutoSwitchDialogProps) {
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const reduceMotion = useReducedMotionPref();
  const setPreviousColorScheme = usePreferencesStore((s) => s.setPreviousColorScheme);
  const setSunlightAutoSwitchDontAskAgain = usePreferencesStore(
    (s) => s.setSunlightAutoSwitchDontAskAgain,
  );
  const setAutoSwitchJustConfirmed = useThemeTransitionStore(
    (s) => s.setAutoSwitchJustConfirmed,
  );

  const styles = React.useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);

  const handleSwitchToLight = () => {
    // SUNLIGHT-1 case (c): set the one-shot flag BEFORE flipping the OS
    // scheme so the root-layout theme-fade effect sees it on the next
    // theme-key change and skips the 150ms crossfade. The UI underneath
    // snaps instantly; the dialog's own dismiss-fade is the only motion.
    setAutoSwitchJustConfirmed(true);
    setPreviousColorScheme('dark');
    Appearance.setColorScheme('light');
    onDismiss();
  };

  const handleKeepDark = () => {
    onDismiss();
  };

  const handleDontAskAgain = () => {
    setSunlightAutoSwitchDontAskAgain(true);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={styles.card}>
          <Text style={styles.title}>Switch to Light too?</Text>
          <Text style={styles.body}>
            Dark mode plus direct sun produces OLED bloom that washes out borders.
            Light gives you a usable surface in glare. Sunlight Mode itself stays on
            either way.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to Light, recommended"
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={handleSwitchToLight}>
            <Text style={styles.primaryBtnText}>Switch to Light (recommended)</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep Dark anyway"
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            onPress={handleKeepDark}>
            <Text style={styles.secondaryBtnText}>Keep Dark anyway</Text>
          </Pressable>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Do not ask again on this device"
            style={({ pressed }) => [styles.tertiaryBtn, pressed && styles.btnPressed]}
            onPress={handleDontAskAgain}>
            <Text style={styles.tertiaryBtnText}>Do not ask again on this device</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: theme.surfaceStrong,
      borderColor: theme.border,
      borderWidth,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    title: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    body: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    primaryBtn: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: theme.buttonText,
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryBtn: {
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '400',
    },
    tertiaryBtn: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    tertiaryBtnText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '400',
      textDecorationLine: 'underline',
    },
    btnPressed: {
      opacity: 0.78,
    },
  });
}
