/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';

import { useTheme } from '@/hooks/use-theme';

export interface AppToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityRole?: string;
  accessibilityLabel?: string;
}

// Metro's platform resolution keeps the native implementation isolated per platform.
export default function AppToggle({
  value,
  onChange,
  accessibilityRole,
  accessibilityLabel,
}: AppToggleProps) {
  const theme = useTheme();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JetpackCompose = require('@expo/ui/jetpack-compose') as {
    Host: React.ComponentType<{ matchContents?: boolean; children: React.ReactNode }>;
    Switch: React.ComponentType<{
      value: boolean;
      onCheckedChange: (value: boolean) => void;
      colors?: Record<string, string>;
    }>;
  };

  return (
    <JetpackCompose.Host matchContents>
      <JetpackCompose.Switch
        value={value}
        onCheckedChange={onChange}
        colors={{
          checkedTrackColor: theme.toggleTrackOn,
          checkedThumbColor: theme.toggleThumbOn,
          uncheckedTrackColor: theme.toggleTrackOff,
          uncheckedThumbColor: theme.toggleThumbOff,
        }}
      />
    </JetpackCompose.Host>
  );
}
