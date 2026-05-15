<!-- generated-by: gsd-doc-writer -->

# Development

## Everyday commands

| Command | Purpose |
| ------- | ------- |
| `npx expo start` | Metro bundler and dev menu |
| `npm run lint` | ESLint via Expo |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest (`jest-expo`) |

## Native workflow

After changing Kotlin/Swift, Gradle settings, Pod configuration, or anything under `modules/*/`, rebuild the app:

```bash
npm run ios
# or
npm run android
```

Native modules autolink from `./modules` (see `package.json`).

## Project layout (short)

- **`src/app/`** — Expo Router routes
- **`src/features/`** — Larger feature screens
- **`src/services/`** — Pack, import, perception
- **`src/providers/`** — LLM and LiteRT integration
- **`src/store/`** — Zustand stores
- **`modules/`** — Local Expo native packages

## AI and agent guidelines

Contributors using automation should read **`AGENTS.md`** at the repo root and **`.planning/REQUIREMENTS.md`** before large changes.

## License

GPL-3.0-or-later.
