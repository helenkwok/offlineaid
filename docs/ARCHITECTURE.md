# Architecture

OfflineAid is an **offline-first** mobile app: **Expo Router** drives navigation, **Zustand** holds client state, and **on-device** inference (GGUF via `llama.rn` / **LiteRT** via a custom module) powers chat when models are loaded.

## High-level layout

| Layer | Location | Responsibility |
| ----- | -------- | ---------------- |
| Routes | `src/app/` | Expo Router screens: chat (`index.tsx`), map, camera, packs, models, explore, settings. |
| Features | `src/features/` | Larger screens (packs, models, scribe, explore). |
| Services | `src/services/` | Pack search/import (`pack.ts`, `pack-import.ts`), perception (`perception.ts`). |
| Providers | `src/providers/` | LLM backend (`llm/`), LiteRT bridge (`litert/`). |
| State | `src/store/` | Domain stores (packs, models, preferences, chat drafts, map, benchmarks). |
| Native | `modules/` | `offlineaid-litert`, `offlineaid-perception` (Expo Modules; require a **development build**). |

## Main data flows

**Chat with optional RAG** — The chat route composes the user message, optionally queries active packs through `src/services/pack.ts`, and streams output via `src/hooks/useLLM.ts` and `src/providers/llm/index.ts` using either the llama or LiteRT backend selected in `src/models/runtime.ts`.

**Knowledge packs** — Import flows validate archives and databases in `src/services/pack-import.ts`; SQLite-backed search and geo helpers live in `src/services/pack.ts`.

**Perception** — `src/services/perception.ts` normalizes native image analysis and transcription results for UI and for `buildPerceptionChatDraft()` when sending context to chat.

## License

GPL-3.0-or-later (see repository headers).
