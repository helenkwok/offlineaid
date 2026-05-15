# Testing

## Unit tests (Jest)

The project uses **Jest** with the **`jest-expo`** preset (`jest.config.js`).

```bash
npm test
```

Run a single file:

```bash
npm test -- src/services/perception.test.ts
```

## What is covered

Colocated tests include:

- `src/services/pack-import.test.ts` — pack import helpers
- `src/services/perception.test.ts` — perception normalization (mocked native module)
- `src/models/runtime.test.ts` — model path and ID helpers
- `src/app/index.test.tsx` — pure chat helper functions (with router/store mocks)

## What is not covered here

End-to-end UI tests, device-only camera/audio flows, and full native module integration are out of scope for the current Jest setup. Use manual checks on a **development build** for those surfaces (see **OPERATOR.md**).

## CI

<!-- VERIFY: If your fork adds GitHub Actions, document the workflow path and required secrets here. -->

Until CI is wired, treat local `lint`, `typecheck`, and `test` as the merge gate.

## License

GPL-3.0-or-later.
