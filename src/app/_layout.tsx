/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/i18n';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOsHighContrast } from '@/hooks/useOsHighContrast';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { useTheme } from '@/hooks/use-theme';
import {
  useGenerationStateStore,
  usePreferencesStore,
  useThemeTransitionStore,
} from '@/store';

// Root <Stack> hosts the (tabs) navigator AND sibling top-level screens.
// Top-level screens (models, packs, general, scribe, smoke-failure-state)
// are pushed above the tab bar from any tab via a normal Stack push, which
// avoids the cross-tab deep-link limitation of NativeTabs (unstable).
// Pattern documented at:
// https://docs.expo.dev/tutorial/add-navigation
// https://docs.expo.dev/router/advanced/modals
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const baseHeaderStackOptions = {
  headerShown: true,
  presentation: 'card' as const,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t: tCommon } = useTranslation('common');
  const { t: tSettings } = useTranslation('settings');
  const headerStackOptions = {
    ...baseHeaderStackOptions,
    headerBackTitle: tCommon('back'),
  };
  const theme = useTheme();
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  // SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 11 (animation restraint).
  //
  // Single Animated.View at the root with a 4-case theme-fade override.
  // The theme-key (resolvedScheme + hc-suffix) flips whenever any of:
  //   - OS dark/light scheme changes
  //   - OS high-contrast preference flips
  //   - In-app Sunlight Mode toggle flips
  // The effect below runs the appropriate animation (or skips it) based on
  // five disjoint cases. Reduced-motion always wins (first guard).
  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const osHighContrast = useOsHighContrast();
  const reduceMotion = useReducedMotionPref();
  const isGenerating = useGenerationStateStore((s) => s.isGenerating);
  const autoSwitchJustConfirmed = useThemeTransitionStore((s) => s.autoSwitchJustConfirmed);
  const setAutoSwitchJustConfirmed = useThemeTransitionStore(
    (s) => s.setAutoSwitchJustConfirmed,
  );

  const hc = osHighContrast || sunlightMode;
  const resolvedScheme = !colorScheme || colorScheme === 'unspecified' ? 'light' : colorScheme;
  const themeKey = `${resolvedScheme}${hc ? 'HC' : ''}`;

  const themeFade = useSharedValue(1);
  const previousKeyRef = React.useRef(themeKey);
  const previousOsHighContrastRef = React.useRef(osHighContrast);
  const previousResolvedSchemeRef = React.useRef(resolvedScheme);

  React.useEffect(() => {
    const previousKey = previousKeyRef.current;
    if (previousKey === themeKey) return;

    const osPrefChanged =
      previousOsHighContrastRef.current !== osHighContrast ||
      previousResolvedSchemeRef.current !== resolvedScheme;

    // Update refs early so the next render compares against the new values.
    previousKeyRef.current = themeKey;
    previousOsHighContrastRef.current = osHighContrast;
    previousResolvedSchemeRef.current = resolvedScheme;

    // Case (e): prefers-reduced-motion always wins. Instant snap.
    if (reduceMotion) return;
    // Case (d): mid-stream. Avoid interfering with token cadence.
    if (isGenerating) return;
    // Case (a): OS preference change. Instant snap.
    if (osPrefChanged) return;
    // Case (c): auto-switch dialog confirmed. UI underneath snaps; the
    // dialog dismiss-fade (Modal animationType="fade") is the only motion.
    // Clear the one-shot flag and skip the crossfade.
    if (autoSwitchJustConfirmed) {
      setAutoSwitchJustConfirmed(false);
      return;
    }
    // Case (b): in-app Sunlight toggle, no scheme change. 150ms opacity
    // crossfade (1 -> 0.5 -> 1), 75ms each leg.
    themeFade.value = withSequence(
      withTiming(0.5, { duration: 75 }),
      withTiming(1.0, { duration: 75 }),
    );
  }, [
    themeKey,
    reduceMotion,
    isGenerating,
    osHighContrast,
    resolvedScheme,
    autoSwitchJustConfirmed,
    setAutoSwitchJustConfirmed,
    themeFade,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: themeFade.value,
  }));

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <ThemeProvider
        value={{
          ...navigationTheme,
          colors: {
            ...navigationTheme.colors,
            primary: theme.accentStrong,
            background: theme.background,
            card: theme.backgroundElement,
            text: theme.text,
            border: theme.border,
            notification: theme.buttonPrimary,
          },
        }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <Animated.View style={animatedStyle}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="models"
              options={{ ...headerStackOptions, title: tSettings('models') }}
            />
            <Stack.Screen
              name="packs"
              options={{ ...headerStackOptions, title: tSettings('packs') }}
            />
            <Stack.Screen
              name="general"
              options={{ ...headerStackOptions, title: tSettings('general') }}
            />
            <Stack.Screen
              name="chat-settings"
              options={{ ...headerStackOptions, title: tSettings('chat') }}
            />
            <Stack.Screen
              name="display"
              options={{ ...headerStackOptions, title: tSettings('display') }}
            />
            <Stack.Screen
              name="language"
              options={{ ...headerStackOptions, title: tSettings('language_section') }}
            />
            <Stack.Screen
              name="map"
              options={{ ...headerStackOptions, title: tSettings('map_title') }}
            />
            <Stack.Screen
              name="smoke-failure-state"
              options={{ ...headerStackOptions, title: tSettings('smoke_test') }}
            />
          </Stack>
        </Animated.View>
        </ThemeProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}
