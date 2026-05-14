/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Type-safe i18next: declare resources by namespace so `t('chat:placeholder')`
// is autocompleted and unknown keys fail at build. The English bundle is the
// canonical key set; other locales fall back to it, so we only register `en`.

import 'i18next';

import a11y from '@/locales/en/a11y.json';
import camera from '@/locales/en/camera.json';
import chat from '@/locales/en/chat.json';
import common from '@/locales/en/common.json';
import errors from '@/locales/en/errors.json';
import explore from '@/locales/en/explore.json';
import models from '@/locales/en/models.json';
import packs from '@/locales/en/packs.json';
import permissions from '@/locales/en/permissions.json';
import scribe from '@/locales/en/scribe.json';
import settings from '@/locales/en/settings.json';
import tabs from '@/locales/en/tabs.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      a11y: typeof a11y;
      camera: typeof camera;
      chat: typeof chat;
      common: typeof common;
      errors: typeof errors;
      explore: typeof explore;
      models: typeof models;
      packs: typeof packs;
      permissions: typeof permissions;
      scribe: typeof scribe;
      settings: typeof settings;
      tabs: typeof tabs;
    };
  }
}
