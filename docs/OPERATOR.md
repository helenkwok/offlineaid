# Operator guide: local verification

This document describes how to set up OfflineAid on a workstation, run automated checks, and understand what **Expo Go** can and cannot do. It avoids copying secrets or tokens into documentation; store Hugging Face or other credentials only in the app’s secure storage on device, not in shell history or committed files.

## Prerequisites

- **Node.js** and **npm** aligned with the versions declared for this project (see root `package.json` engines if present).
- For native rebuilds: **Android Studio** (SDK, emulator) and/or **Xcode** on macOS, matching your target platform.
- A physical device or emulator for anything that touches camera, microphone, or on-device inference.

## Clone and install

```bash
git clone <repository-url>
cd offlineaid
npm ci
```

Use `npm ci` on CI-like machines so the lockfile is honored. For day-to-day iteration, `npm install` is acceptable when you intentionally change dependencies.

## Automated verification

Run these from the repository root before pushing substantive changes:

```bash
npm run lint
npm run typecheck
npm test
```

- **Lint** catches style and many correctness issues in TypeScript and React code.
- **Typecheck** (`npx tsc --noEmit` is also available via the `typecheck` script if defined) ensures the project compiles under strict TypeScript settings.
- **Tests** use Jest with the Expo preset; they cover pure helpers and service normalization without requiring a device.

If a script name differs in `package.json`, follow the scripts section as the source of truth.

## Expo Go vs development build

**Expo Go** is useful for iterating on JavaScript-only UI, but OfflineAid relies on **local Expo modules** under `modules/` (LiteRT, perception, and related native code). Those modules are not shipped inside the stock Expo Go app from the store.

Use a **development build** (custom dev client) when you need:

- Image analysis or barcode flows backed by native perception.
- LiteRT model loading and inference paths gated in the app.
- Any behavior that calls `requireNativeModule` for OfflineAid-specific native code.

Build and install the dev client with `npx expo run:android` or `npx expo run:ios` after native or module changes; see [NATIVE.md](./NATIVE.md).

## Logging and security

- Do not log **API keys**, **Hugging Face tokens**, **pack contents**, or **raw transcripts** from the field into shared logs or planning documents.
- Treat operator notes and screenshots as potentially sensitive if they contain user-generated text or location context.

## Local pre-push checklist

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. For changes under `modules/` or native project folders: rebuild the dev client and smoke-test the affected screen on a device or emulator.

## Future: CI

Continuous integration (for example a GitHub Actions workflow at `.github/workflows/verify.yml` that runs lint, typecheck, and tests) is **deferred until after Phase 6** of the current roadmap. Until that workflow exists, treat the commands above as the authoritative local gate.
