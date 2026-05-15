# OfflineAid

OfflineAid is a multilingual **offline-first** resilience app: local knowledge packs and on-device models help when the network is missing or unsafe to rely on. It is built with **Expo** and **React Native**, with custom native modules under `modules/` for LiteRT and on-device perception.

## Documentation

- **[docs/README.md](./docs/README.md)** — index of operator and technical guides (verification, native builds, packs, models).
- **[`.planning/`](./.planning/)** — GSD planning: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and phase artifacts.

## Prerequisites

- **Node.js** and **npm** (see `package.json` for tooling alignment).
- For full functionality (camera, speech, LiteRT): a **development build** — custom native modules are not available in the stock **Expo Go** app. See [docs/NATIVE.md](./docs/NATIVE.md).

## Quick start

```bash
git clone <repository-url>
cd offlineaid
npm ci
npx expo start
```

Use a dev client from `npm run android` or `npm run ios` when testing native features. See [docs/OPERATOR.md](./docs/OPERATOR.md) for the full verification matrix.

## Verification

```bash
npm run lint
npm run typecheck
npm test
```

Continuous integration for these steps is planned after Phase 6; local runs are the current gate.

## License

GPL-3.0-or-later (see repository headers and `package.json`).
