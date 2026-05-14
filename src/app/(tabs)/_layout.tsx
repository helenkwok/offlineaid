/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

// (tabs)/_layout.tsx — the tab navigator. Sits inside the root <Stack> so
// top-level routes (models, packs, general, scribe, smoke-failure-state) can
// be pushed above the tab bar from any tab. This is the canonical Expo Router
// pattern for "stack hosting tabs + sibling screens":
// https://docs.expo.dev/tutorial/add-navigation
// https://docs.expo.dev/router/advanced/modals
//
// NativeTabs.Trigger.Icon picks the platform-correct prop:
//   sf=        SF Symbol on iOS
//   md=        Material icon on Android (built into expo-router)
//
// SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 7 active-tab pill HC invariant
// (11-10 Task 3): colours flow through useTheme() so lightHC / darkHC palettes
// take effect automatically. The active-pill `indicatorColor` is bound to a
// NEUTRAL token (theme.backgroundElement), NEVER theme.accent / buttonPrimary.
// Red is reserved for the FAIL-LADDER severity rungs and verification CTAs.
// Under HC the indicator collapses to pure white (lightHC) or pure black
// (darkHC); the active state still reads through the labelStyle.selected color
// (theme.text) and the platform's icon tint for the active trigger.

export default function TabsLayout() {
  const colors = useTheme();
  const { t } = useTranslation('tabs');

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>

      <NativeTabs.Trigger name="(index)">
        <NativeTabs.Trigger.Label>{t('chat')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="chat" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(camera)">
        <NativeTabs.Trigger.Label>{t('camera')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera.viewfinder" md="photo_camera" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(explore)">
        <NativeTabs.Trigger.Label>{t('explore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(scribe)">
        <NativeTabs.Trigger.Label>{t('scribe')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform" md="graphic_eq" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Label>{t('settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
