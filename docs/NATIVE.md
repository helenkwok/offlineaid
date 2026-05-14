# Native builds and local modules

OfflineAid ships **local Expo modules** under `modules/` (for example `offlineaid-litert` and `offlineaid-perception`). Autolinking picks them up when you use a **development build** or release build generated from this repository. The stock **Expo Go** app from the app stores does not include these native implementations, so features that depend on them will fail or show runtime gates until you install a build that contains the modules.

## When to rebuild

Rebuild and reinstall the native app (dev client or release) after you change any of the following:

- Kotlin or Swift sources under `modules/*/android/` or `modules/*/ios/`
- Gradle, Podspec, or Xcode project settings for those modules
- `expo-module.config.json` or autolinking-related configuration
- Native dependencies that require a new binary (ML Kit, LiteRT, and similar)

Pure TypeScript or JavaScript changes under `src/` often do not require a native rebuild unless they call new native APIs you just added.

## Android

From the repository root, with Android SDK and an emulator or device available:

```bash
npx expo run:android
```

This compiles the Android project, links local modules, and installs the app. Use the same command after pulling changes that touch `modules/` or `android/` in this repo.

Gradle tasks invoked by Expo may vary by SDK version; prefer any project-specific Gradle verification task documented in this repo for release-critical checks.

## iOS (macOS)

With Xcode installed and signing configured for your team:

```bash
npx expo run:ios
```

This builds the iOS target with CocoaPods integration for local modules. Run `pod install` inside `ios/` only when the project’s Expo or React Native upgrade instructions say to; `expo run:ios` often handles the expected flow.

## Autolinking

Expo’s autolinking discovers packages that declare themselves as Expo modules. Local packages live under `modules/<name>/` and are referenced from the root `package.json` like other workspace dependencies. If a native symbol is missing at runtime, confirm the package is listed as a dependency and that you are not running inside plain Expo Go.

## Web

The web bundle may omit or stub native-only code paths. Perception and on-device model features are oriented toward **iOS and Android**; use the native dev client for authoritative behavior.
