/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SwiftUI = require('@expo/ui/swift-ui') as {
    Host: React.ComponentType<{ matchContents?: boolean; children: React.ReactNode }>;
    Toggle: React.ComponentType<{
      isOn: boolean;
      onIsOnChange: (value: boolean) => void;
      label: string;
    }>;
  };

  return (
    <SwiftUI.Host matchContents>
      <SwiftUI.Toggle
        isOn={value}
        onIsOnChange={onChange}
        label={accessibilityLabel || ""}
      />
    </SwiftUI.Host>
  );
}
