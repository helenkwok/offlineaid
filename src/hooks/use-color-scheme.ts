/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from 'react';
import { Platform, useColorScheme as useRNColorScheme } from 'react-native';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function getWebColorScheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

export function useColorScheme() {
  const nativeScheme = useRNColorScheme();
  const [webColorScheme, setWebColorScheme] = useState<'light' | 'dark'>(() => getWebColorScheme());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_SCHEME_QUERY);
    const updateScheme = () => {
      setWebColorScheme(mediaQuery.matches ? 'dark' : 'light');
    };

    updateScheme();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateScheme);
      return () => mediaQuery.removeEventListener('change', updateScheme);
    }

    mediaQuery.addListener(updateScheme);
    return () => mediaQuery.removeListener(updateScheme);
  }, []);

  return Platform.OS === 'web' ? webColorScheme : nativeScheme;
}
