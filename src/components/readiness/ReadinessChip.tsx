/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import i18next from 'i18next';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { type AppTheme } from '@/constants/theme';
import { severityStyle } from '@/components/severity/severityStyle';
import type { ReadinessState, SeverityRung } from '@/components/readiness/types';
import { useReadinessState } from '@/hooks/useReadinessState';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { ReadinessSheet } from '@/components/readiness/ReadinessSheet';

// FAIL-LADDER-1 / 11-DESIGN-BRIEF rev 6 sections 6 + 7. Single header-zone chip
// rendering one of six readiness states. Severity rungs differentiate by
// weight + border + icon + tracking + density (NOT new colour tokens).
//
// The 'error'-rung leading icon defaults to `exclamationmark.circle` per brief
// section 6 line 55 explicit rejection of the exclamation-in-triangle cliche.
// `.triangle.fill` is escalation-only; consumers may override at checkpoint.

interface RenderConfig {
  rung: SeverityRung;
  label: string;
  fill: string;
  border: string;
  textColor: string;
  shimmer: boolean;
  ringAccent?: boolean;
  dot?: boolean;
}

// Use i18next.t directly so deriveRender does not depend on the
// useTranslation() destructure being settled at first render. The cast
// through unknown bypasses the strict-typed key whitelist (new keys exist
// at runtime in the chat namespace bundle).
const t = (key: string, opts?: Record<string, unknown>) =>
  (i18next.t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, opts);

function deriveRender(state: ReadinessState, theme: AppTheme): RenderConfig {
  switch (state.kind) {
    case 'no-model':
      return {
        rung: 'critical',
        label: t('chat:readiness_no_model'),
        fill: theme.buttonPrimary,
        border: theme.buttonPrimary,
        textColor: theme.accentText,
        shimmer: false,
      };
    case 'model-loading':
      return {
        rung: 'warn',
        label: t('chat:readiness_model_loading', { modelName: state.modelName }),
        fill: theme.surfaceMuted,
        border: theme.accent,
        textColor: theme.text,
        shimmer: true,
      };
    case 'model-loaded-no-pack':
      return {
        rung: 'warn',
        label: t('chat:readiness_no_pack'),
        fill: theme.surfaceMuted,
        border: theme.accent,
        textColor: theme.text,
        shimmer: false,
      };
    case 'pack-loading':
      return {
        rung: 'warn',
        label: t('chat:readiness_pack_loading'),
        fill: theme.surfaceMuted,
        border: theme.accent,
        textColor: theme.text,
        shimmer: true,
      };
    case 'ready-idle': {
      const langs = state.languages.length > 0 ? state.languages.join('/') : '';
      const packsPart = t('chat:readiness_packs', { count: state.packCount });
      const parts = [t('chat:readiness_ready'), packsPart];
      if (langs) parts.push(langs);
      parts.push(state.freshness);
      return {
        rung: 'none',
        label: parts.join(' · '),
        fill: theme.surfaceMuted,
        border: theme.border,
        textColor: theme.textSecondary,
        shimmer: false,
        dot: true,
      };
    }
    case 'ready-streaming':
      return {
        rung: 'none',
        label: t('chat:readiness_streaming'),
        fill: theme.surfaceMuted,
        border: theme.accent,
        textColor: theme.textSecondary,
        shimmer: false,
        ringAccent: true,
      };
  }
}

function severityIconName(rung: SeverityRung, hasFill: boolean): SFSymbol | null {
  // Maps severityStyle().leadingIcon semantic key -> SF Symbol name.
  // 'warn' renders as `exclamationmark.circle` (DEFAULT -- brief section 6 anti-cliche).
  // 'critical' on a solid red fill omits the icon: the fill is already the
  // strongest possible signal, and on Android the SF Symbol fallback for
  // `xmark.octagon.fill` rendered as a wide placeholder that clipped the
  // chip text. Border-only critical states (if any future variant adds them)
  // still get the icon.
  const primitives = severityStyle(rung);
  switch (primitives.leadingIcon) {
    case 'none':
      return null;
    case 'warn':
      return 'exclamationmark.circle';
    case 'critical':
      return hasFill ? null : 'xmark.octagon.fill';
  }
}

function ReadinessChipBase() {
  const theme = useTheme();
  const hcBorderWidth = useBorderWidth();
  const reducedMotion = useReducedMotionPref();
  const state = useReadinessState();
  const [sheetVisible, setSheetVisible] = useState(false);
  // Subscribe to language changes so the chip re-renders when the user
  // switches locale via the picker. The `i18n.language` value flips on
  // changeLanguage and triggers a re-evaluation of deriveRender.
  const { i18n } = useTranslation();
  const language = i18n.language;

  const render = useMemo(
    () => deriveRender(state, theme),
    // language included so changing locale forces a fresh deriveRender pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, theme, language],
  );
  const sevStyle = useMemo(() => severityStyle(render.rung), [render.rung]);
  const hasFill = render.fill !== theme.surfaceMuted;
  const iconName = severityIconName(render.rung, hasFill);

  // Shimmer animation. Gates on reducedMotion: when reduce motion is on, hold
  // a static lower opacity instead of oscillating (still readable per WCAG).
  const shimmer = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!render.shimmer) {
      shimmer.setValue(1);
      return;
    }
    if (reducedMotion) {
      shimmer.setValue(0.85);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.7,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [render.shimmer, reducedMotion, shimmer]);

  const onPress = useCallback(() => {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setSheetVisible(true);
  }, []);

  const styles = useMemo(() => createStyles(), []);

  // SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 3 (11-10 Task 3): the chip
  // surface respects useBorderWidth() so it thickens to 2px under HC/Sunlight.
  // We Math.max() against the rung's severityStyle().borderWidth so the rung
  // contrast (0 / 1 / 1.5 / 2) is preserved when amplified by HC. The
  // ringAccent variant (ready-streaming) keeps a >=1px ring even at the
  // 'none' rung.
  const ringAccentMin = render.ringAccent ? 1 : sevStyle.borderWidth;
  const containerStyle: ViewStyle = {
    backgroundColor: render.fill,
    borderColor: render.border,
    borderWidth: Math.max(sevStyle.borderWidth, ringAccentMin, hcBorderWidth),
    paddingVertical: 0,
    paddingHorizontal: 10,
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Readiness: ${render.label}. Tap to view details.`}
        onPress={onPress}
        hitSlop={6}>
        <Animated.View style={[styles.chip, containerStyle, { opacity: shimmer }]}>
          {render.dot ? (
            <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />
          ) : null}
          {iconName ? (
            <SymbolView name={iconName} size={12} tintColor={theme.accent} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: render.textColor,
                fontWeight: sevStyle.fontWeight,
                letterSpacing: sevStyle.letterSpacing,
              },
            ]}>
            {render.label}
          </Text>
        </Animated.View>
      </Pressable>
      <ReadinessSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        state={state}
      />
    </>
  );
}

function createStyles() {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 28,
      borderRadius: 6,
      borderCurve: 'continuous',
      maxWidth: 240,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    label: {
      // fontSize 10 (down from 11): at fontWeight 600 + Pixel 7 / Hermes /
      // bundled font, glyph ink for the trailing 'l' in 'No model' extended
      // past the measured advance width, clipping the chip's right edge
      // even with 32dp internal padding. Smaller fontSize produces tighter
      // glyph metrics that fit cleanly. WCAG min for non-essential UI text
      // is 11pt iOS / unspecified Android; 10dp on a 28dp tall chip remains
      // legible in the field-app context.
      fontSize: 10,
      maxWidth: 200,
    },
  });
}

export const ReadinessChip = memo(ReadinessChipBase);
export default ReadinessChip;
