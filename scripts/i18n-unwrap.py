#!/usr/bin/env python3
"""
Fixup pass for the translation staging output.

Gemma 4 26B consistently wraps the namespace JSON in a parent key matching
the namespace name (e.g. `{"a11y": {"live_performance": "..."}}` instead of
`{"live_performance": "..."}`). This script unwraps that single-key parent
when the parent name matches the file stem AND its value is an object.

Usage:
    python3 scripts/i18n-unwrap.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STAGING = REPO / "scripts" / "i18n-staging"
EN_DIR = REPO / "src" / "locales" / "en"


def expected_keys(ns_name: str) -> set[str]:
    en_path = EN_DIR / f"{ns_name}.json"
    return set(json.loads(en_path.read_text()).keys())


def fix_file(path: Path) -> tuple[bool, str]:
    ns_name = path.stem
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        return False, "not a dict"

    expected = expected_keys(ns_name)

    # Already flat and complete? Nothing to do.
    if set(raw.keys()) == expected:
        return True, "already flat"

    # Classic wrap case: single key, value is the inner dict.
    if len(raw) == 1 and isinstance(next(iter(raw.values())), dict):
        wrap_key, inner = next(iter(raw.items()))
        if set(inner.keys()) == expected:
            path.write_text(json.dumps(inner, indent=2, ensure_ascii=False) + "\n")
            return True, f"unwrapped (parent='{wrap_key}')"
        return False, f"wrap inner keys differ: got {sorted(set(inner.keys()))}, expected {sorted(expected)}"

    missing = expected - set(raw.keys())
    extra = set(raw.keys()) - expected
    return False, f"flat but key mismatch (missing={sorted(missing)} extra={sorted(extra)})"


def main():
    if not STAGING.exists():
        print(f"FATAL: {STAGING} missing", file=sys.stderr)
        sys.exit(1)

    fixed = 0
    skipped = 0
    failed = 0

    for locale_dir in sorted(STAGING.iterdir()):
        if not locale_dir.is_dir():
            continue
        print(f"[{locale_dir.name}]")
        for json_path in sorted(locale_dir.glob("*.json")):
            ok, msg = fix_file(json_path)
            mark = "✓" if ok else "✗"
            print(f"  {mark} {json_path.name}: {msg}")
            if ok and "unwrapped" in msg:
                fixed += 1
            elif ok:
                skipped += 1
            else:
                failed += 1

    print()
    print(f"unwrapped: {fixed} · already flat: {skipped} · failed: {failed}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
