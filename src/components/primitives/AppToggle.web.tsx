/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Switch } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface AppToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityRole?: string;
  accessibilityLabel?: string;
}

export default function AppToggle({
  value,
  onChange,
  accessibilityRole,
  accessibilityLabel,
}: AppToggleProps) {
  const theme = useTheme();

  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.toggleTrackOff, true: theme.toggleTrackOn }}
      thumbColor={value ? theme.toggleThumbOn : theme.toggleThumbOff}
      // @ts-ignore
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
