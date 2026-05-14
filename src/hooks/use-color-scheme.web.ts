/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from 'react';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function getWebColorScheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

/**
 * Static rendering always starts in light mode on the server. Recalculate the
 * browser preference on the client and subscribe to media-query changes so the
 * web UI follows live light/dark switches too.
 */
export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() => getWebColorScheme());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_SCHEME_QUERY);
    const updateScheme = () => {
      setColorScheme(mediaQuery.matches ? 'dark' : 'light');
    };

    updateScheme();
    mediaQuery.addEventListener('change', updateScheme);

    return () => {
      mediaQuery.removeEventListener('change', updateScheme);
    };
  }, []);

  return colorScheme;
}
