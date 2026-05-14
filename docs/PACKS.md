# Knowledge packs

OfflineAid can import **offline knowledge packs** so retrieval-augmented prompts stay useful when the network is unavailable or untrusted. Packs are SQLite databases (or archives wrapping them) that the app indexes and queries locally.

## Formats

The import pipeline distinguishes at least these shapes (see implementation in `src/services/pack-import.ts` for exact rules):

- **SQLite database files** (commonly `.db`): opened as a local pack database for FTS-backed search where enabled.
- **Pack archives** (for example `.oapack.zip` style bundles): validated and extracted so the contained database and metadata land in the app-controlled storage area.

Invalid or suspicious inputs should be rejected before they are executed as SQL from untrusted sources. The service layer performs filename and structure checks; treat any change to import logic as security-sensitive.

## Safety overview

- **Trust boundary**: Packs come from files the user selects or side-loads. Treat pack SQL and content as untrusted data; use parameterized queries and avoid constructing SQL from pack-supplied fragments except through vetted schema operations.
- **Validation**: Centralize magic-byte, extension, and structural checks in `pack-import` (and related services) rather than duplicating checks in UI code.
- **No secrets in packs**: Packs are for public or intentionally offline reference material, not for storing API keys. Tokens for Hugging Face or other services belong in secure device storage, not inside pack files committed to git.

## Developer reference

For field names, validation steps, and error messages, read `src/services/pack-import.ts` alongside unit tests in `src/services/pack-import.test.ts`. Those tests document expected behavior for helper functions without requiring a device.

## User-facing behavior

The Packs screen in the app lists active packs, toggles participation in retrieval, and surfaces import errors in human-readable form. Operators validating a release should import a small known-good pack, confirm search hits, then remove the test pack if policy requires a clean device.
