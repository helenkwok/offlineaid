# Getting started

## What you need

- **Node.js** and **npm** compatible with this repo’s `package.json`.
- **Xcode** (macOS) and/or **Android Studio** if you will run **native** builds or use simulators/emulators.

## Clone and install

```bash
git clone <repository-url>
cd offlineaid
npm ci
```

## Run the dev server

```bash
npx expo start
```

From the Expo CLI UI you can open **web**, **iOS Simulator**, or **Android emulator** when configured.

## Expo Go vs development build

**Expo Go** from the app store does **not** include OfflineAid’s custom native modules (`offlineaid-litert`, `offlineaid-perception`). For camera perception, LiteRT models, and full offline-native behavior, build and install a **development client**:

```bash
npm run ios
# or
npm run android
```

See **[NATIVE.md](./NATIVE.md)** and **[OPERATOR.md](./OPERATOR.md)** for rebuild triggers and verification.

## First-time orientation

1. Read the root **[README.md](../README.md)** for the one-screen overview.
2. Use **[docs/README.md](./README.md)** as the index to operator and topic guides (packs, models, native).

## License

GPL-3.0-or-later.
