/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Per-variant package id so the dev client coexists with the preview/release
// build on the same device. Default (preview/production/EAS no-env) keeps the
// historical "com.helenkwok.offlineaid" so signed builds and Play Store
// uploads do not change identity. APP_VARIANT=development is set by the
// `development` profile in eas.json and produces the .dev-suffixed apk.

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => {
  const pkg = IS_DEV ? 'com.helenkwok.offlineaid.dev' : 'com.helenkwok.offlineaid';
  const name = IS_DEV ? `${config.name} (dev)` : config.name;

  return {
    ...config,
    name,
    android: {
      ...config.android,
      package: pkg,
      // Models and packs are multi-GB. Excluding from Android Auto Backup
      // prevents Google's cloud backup quota from filling on first install
      // and prevents stale model state from being restored on reinstall
      // (which surprised testers who expected a fresh state after uninstall).
      allowBackup: false,
    },
  };
};
