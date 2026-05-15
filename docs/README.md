# OfflineAid documentation

This folder is the entry point for **operators** (local verification, releases) and **contributors** who need more depth than the root `README.md`.

## Contents

| Document | Purpose |
| -------- | ------- |
| [GETTING-STARTED.md](./GETTING-STARTED.md) | Clone, install, Expo Go vs dev client, first links |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App layers, data flows, where to find deeper planning maps |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Day-to-day commands and repo layout for contributors |
| [TESTING.md](./TESTING.md) | Jest setup, what is covered, CI note |
| [CONFIGURATION.md](./CONFIGURATION.md) | `app.json`, TypeScript paths, secrets policy |
| [OPERATOR.md](./OPERATOR.md) | Install, clone, lint, typecheck, tests, dev client vs Expo Go, security/logging rules, pre-push checklist, and CI roadmap |
| [NATIVE.md](./NATIVE.md) | Rebuilding the app when local Expo modules (`modules/`) change; Android and iOS run commands |
| [PACKS.md](./PACKS.md) | Knowledge pack formats, import flow, and safety expectations |
| [MODELS.md](./MODELS.md) | On-device models (LiteRT / GGUF), runtime helpers, Hugging Face token handling without storing secrets in the repo |

## Planning and requirements

Product direction, phased roadmap, and traceability live under [`.planning/`](../.planning/). Start with `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` if you are aligning work with the current milestone.

## Expo Go vs development build

**Expo Go** is a quick sandbox but does not include OfflineAid’s custom native modules (`offlineaid-litert`, `offlineaid-perception`, and related bridges). For perception, on-device models, and full offline flows, use a **development build** (custom dev client) built from this repository. See [OPERATOR.md](./OPERATOR.md) and [NATIVE.md](./NATIVE.md) for the exact commands.

## Verification at a glance

From the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

Details and optional native runs are in [OPERATOR.md](./OPERATOR.md).
