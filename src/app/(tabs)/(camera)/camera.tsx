/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CameraSession } from '@/features/camera/CameraSession';

export default function CameraScreen() {
  const { t } = useTranslation('camera');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <CameraSession />
    </>
  );
}
