/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCameraSession } from './use-camera-session';

export function PermissionGate() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { state, permission, handleRequestPermission } = useCameraSession();
  const { t } = useTranslation('permissions');
  const { t: tCamera } = useTranslation('camera');

  const permissionCopy = useMemo(() => {
    if (!permission) return null;
    if (permission.granted) return null;
    if (permission.canAskAgain) {
      return {
        title: t('camera_title'),
        body: t('camera_body'),
        action: t('camera_action'),
      };
    }
    return {
      title: t('camera_blocked_title'),
      body: t('camera_blocked_body'),
      action: t('camera_blocked_action'),
    };
  }, [permission, t]);

  // Once permission is granted, the live viewfinder confirms readiness.
  // Capability info only surfaces when something is genuinely wrong, so it
  // stops competing with the actual camera controls.
  if (permission?.granted) {
    if (!state.capabilitiesError) return null;
    return (
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{tCamera('perception_capabilities')}</Text>
        <Text style={styles.errorText}>{state.capabilitiesError}</Text>
      </View>
    );
  }

  if (!permissionCopy) return null;

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>{permissionCopy.title}</Text>
      <Text style={styles.statusBody}>{permissionCopy.body}</Text>
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        onPress={handleRequestPermission}
        accessibilityRole="button"
        accessibilityLabel={permissionCopy.action}>
        <Text style={styles.secondaryButtonText}>{permissionCopy.action}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    statusCard: {
      backgroundColor: theme.surfaceAccent,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 10,
    },
    statusTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    statusBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    errorText: {
      color: theme.warningText,
      fontSize: 13,
      fontWeight: '600',
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
    buttonPressed: {
      opacity: 0.84,
    },
  });
}
