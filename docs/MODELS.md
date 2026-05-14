# Models and runtime

OfflineAid targets **on-device** inference so travelers and emergency users are not blocked by connectivity. The app coordinates **LiteRT** task bundles and related runtimes through a TypeScript layer in `src/models/runtime.ts` and the `offlineaid-litert` Expo module.

## GGUF and LiteRT

- **LiteRT** (`.task` / `.litertlm` and related artifacts) is the primary path for Gemma-class models wired in this repository. Platform support varies: some bundles are documented or wired for Android first; iOS may show explicit gates for unsupported combinations.
- **GGUF** or other formats may appear in roadmap or provider copy; follow `runtime.ts` and store-backed download state for what the **current** build actually loads.

Always check the in-app model picker and any **RuntimeGate** or platform messages before assuming a given model ID works on your device.

## Hugging Face and tokens

Model files are often downloaded from **Hugging Face** or similar registries. The app stores the user’s token in **secure device storage** (for example Expo SecureStore), not in repository files or environment variables checked into git.

**Do not** paste real tokens into `README`, `docs/`, issues, or chat logs. Use the in-app settings flow to enter credentials. Rotate tokens if they are ever exposed.

## Runtime helpers

`src/models/runtime.ts` contains pure helpers (model ID parsing, filename extraction, gated model sets, file URI handling) used by download and load flows. Unit tests in `src/models/runtime.test.ts` document expected formats such as `owner/repo/filename` model IDs.

## Verification

After changing runtime logic:

1. `npm run typecheck`
2. `npm test -- src/models/runtime.test.ts`
3. On device: download a small allowed model, confirm load, run a short generation, then unload if you need to reclaim space.

For native bridge changes, rebuild the dev client per [NATIVE.md](./NATIVE.md).
