/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Stack } from 'expo-router';

// Settings tab's inner navigator. Subscreens (models, packs, general,
// scribe, smoke-failure-state) are now top-level routes hosted by the
// root <Stack> in app/_layout.tsx, NOT children of this stack — keeping
// them at the root means cross-tab Links from other tabs are normal
// Stack pushes instead of cross-tab deep links into NativeTabs.
//
// This file remains because parens-group folders are URL-transparent;
// without a _layout.tsx the (settings)/index.tsx would collide at URL '/'
// with (index)/index.tsx. The minimal Stack here just hosts the hub.
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
