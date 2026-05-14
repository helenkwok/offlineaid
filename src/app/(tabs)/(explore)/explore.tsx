/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardController } from 'react-native-keyboard-controller';
import type { SearchBarCommands } from 'react-native-screens';

import ExploreScreen from '@/features/explore/ExploreScreen';

export default function TabExploreScreen() {
  const [filter, setFilter] = useState('');
  const { t } = useTranslation('explore');
  // Imperative ref into the native search bar; calling blur() removes focus
  // from the native input, which together with KeyboardController.dismiss()
  // collapses the IME on Android (RN's Keyboard module cannot reach the
  // native UISearchBar/SearchView's IME on its own).
  const searchBarRef = useRef<SearchBarCommands | null>(null);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('title'),
          headerSearchBarOptions: {
            ref: searchBarRef,
            placeholder: t('search_placeholder'),
            hideWhenScrolling: false,
            onChangeText: (e: { nativeEvent: { text: string } }) =>
              setFilter(e.nativeEvent.text),
            onSearchButtonPress: () => {
              searchBarRef.current?.blur();
              KeyboardController.dismiss();
            },
          },
        }}
      />
      <ExploreScreen query={filter} onQueryChange={setFilter} />
    </>
  );
}
