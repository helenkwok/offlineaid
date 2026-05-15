# Configuration

This document describes **repository-visible** configuration. Anything not present in the tree is marked for manual verification.

## Application (`app.json`)

- **Expo app** — `expo.name`, `expo.slug`, `expo.version`, scheme `offlineaid`, orientation, icons, Android package `com.helenkwok.offlineaid`.
- **Plugins** (order as in repo): `expo-router`; `expo-camera`; `expo-image-picker`; `expo-audio`; `expo-speech-recognition`; `./plugins/with-offlineaid-android-toolchain`; `expo-secure-store`; `expo-splash-screen`; `llama.rn`; `expo-build-properties` (iOS deployment target 15.5, static frameworks; Android Kotlin 2.3.0); `expo-sqlite`; `expo-web-browser`; `expo-font`; `expo-image`.
- **Experiments** — `typedRoutes: true`, `reactCompiler: true`.
- **EAS** — `expo.extra.eas.projectId` is set for EAS project linkage (see `app.json`).

## Package and autolinking (`package.json`)

- **`expo.autolinking.nativeModulesDir`** — `./modules` so local Expo packages under `modules/` are linked into native builds.
- **Scripts** — `start`, `android` / `ios` (native run), `lint`, `typecheck`, `test` (Jest).

## TypeScript (`tsconfig.json`)

- **`strict: true`**
- **Paths** — `@/*` → `./src/*`, `@/assets/*` → `./assets/*`

## Secrets and tokens

- **Hugging Face** (and similar) read tokens belong in **Expo SecureStore** at runtime, not in committed files.
- Do not add `.env` files with live secrets to the repo.

## CI

<!-- VERIFY: Confirm whether GitHub Actions (or other CI) is enabled for this fork; docs/OPERATOR.md states CI may be deferred. -->

Local verification today is typically `npm run lint`, `npm run typecheck`, and `npm test`. Add or adjust CI in `.github/workflows/` when your team enables it.

## License

GPL-3.0-or-later.
