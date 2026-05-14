#!/usr/bin/env python3
"""
Translate i18n namespace JSONs from en/ into zh-Hans, zh-Hant, ar via
Gemma 4 26B-A4B (Ollama on Mac).

Outputs to scripts/i18n-staging/{locale}/{ns}.json so the user can review
before promoting into src/locales/. Each namespace is one Ollama call.

Rules baked into the prompt:
 - {{placeholders}} preserved exactly (i18next interpolation)
 - Brand tokens never translated
 - JSON keys identical to en/; only values translate
 - One-pass; if the model returns invalid JSON, the file is left at <ns>.json.raw
   for manual repair rather than silently dropped

Run:
    cd repositories/offlineaid
    uv run --python 3.12 --with requests scripts/translate-i18n.py
or just:
    python3 scripts/translate-i18n.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
# Gemma 4 E4B (9.6 GB Q4) — same Gemma 4 family as the 26B, much faster on
# M4 Max for short JSON translation tasks where the 26B's reasoning budget
# is overkill. We checked register on a 18-key namespace and quality holds.
MODEL = "gemma4:e4b"

REPO = Path(__file__).resolve().parent.parent
EN_DIR = REPO / "src" / "locales" / "en"
OUT_DIR = REPO / "scripts" / "i18n-staging"

TARGETS = {
    "zh-Hans": "Simplified Chinese (Mandarin, written in simplified characters as used in mainland China and Singapore)",
    "zh-Hant": "Traditional Chinese (Mandarin, written in traditional characters as used in Taiwan, Hong Kong, and Macau)",
    "ar": "Modern Standard Arabic (formal register suitable for safety/emergency UI; avoid colloquial dialect)",
}

BRAND_TOKENS = [
    "OfflineAid", "Gemma 4", "Gemma", "LiteRT-LM", "LiteRT", "Pixel 7",
    "Ollama", "Centrelink", "MMKV", "Hugging Face", "Qwen", "Nomic",
    "TTFT", "Decode", "AI Edge", "MoE",
    ".oapack", ".db", ".oapack.zip", "hf_",
]


def build_prompt(locale_name: str, ns_name: str, en_bundle: dict) -> str:
    en_json = json.dumps(en_bundle, indent=2, ensure_ascii=False)
    example_keys = list(en_bundle.keys())[:2]
    example_shape = "{\n  " + ",\n  ".join(f'"{k}": "<translated>"' for k in example_keys) + "\n}"
    return f"""Translate the English UI strings below into {locale_name}.

Output a single FLAT JSON object. Do NOT wrap in a parent object. Example shape:

{example_shape}

Rules:
- Translate string VALUES only. Keys stay identical.
- Preserve {{{{placeholder}}}} tokens verbatim (e.g. {{{{count}}}}, {{{{name}}}}).
- Keep these brand tokens in Latin script: {", ".join(BRAND_TOKENS)}.
- Match the brevity of the English source. Short UI copy, no explanatory padding.
- For Arabic: Modern Standard Arabic, formal emergency-guidance register.

English source:
{en_json}

Translated JSON:"""


def call_ollama(prompt: str, retries: int = 1) -> str:
    # Streaming so we see tokens land in real-time — gives a visible heartbeat
    # and lets us catch model stalls early instead of timing out at 600s.
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": True,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_ctx": 4096,
        },
    }).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    last_err = None
    for attempt in range(retries + 1):
        try:
            chunks = []
            with urllib.request.urlopen(req, timeout=300) as resp:
                for line in resp:
                    if not line.strip():
                        continue
                    obj = json.loads(line)
                    if obj.get("response"):
                        chunks.append(obj["response"])
                    if obj.get("done"):
                        break
            return "".join(chunks)
        except Exception as exc:
            last_err = exc
            if attempt < retries:
                time.sleep(2)
            continue
    raise RuntimeError(f"Ollama call failed after retries: {last_err}")


def validate(en_bundle: dict, translated: dict) -> list[str]:
    """Return list of validation issues; empty = pass."""
    issues = []
    en_keys = set(en_bundle.keys())
    tr_keys = set(translated.keys())
    missing = en_keys - tr_keys
    extra = tr_keys - en_keys
    if missing:
        issues.append(f"missing keys: {sorted(missing)}")
    if extra:
        issues.append(f"extra keys: {sorted(extra)}")
    for key in en_keys & tr_keys:
        en_val = en_bundle[key]
        tr_val = translated[key]
        if not isinstance(tr_val, str):
            issues.append(f"{key}: value not a string ({type(tr_val).__name__})")
            continue
        for token in ["{{", "}}"]:
            if en_val.count(token) != tr_val.count(token):
                issues.append(f"{key}: placeholder brace count mismatch ({en_val.count(token)} en vs {tr_val.count(token)} tr)")
                break
        # Extract placeholder identifiers and verify they survived
        import re
        en_phs = sorted(re.findall(r"\{\{([^}]+)\}\}", en_val))
        tr_phs = sorted(re.findall(r"\{\{([^}]+)\}\}", tr_val))
        if en_phs != tr_phs:
            issues.append(f"{key}: placeholder identifiers diverged: en={en_phs} tr={tr_phs}")
    return issues


def translate_namespace(locale: str, ns_path: Path) -> tuple[bool, str]:
    ns_name = ns_path.stem
    en_bundle = json.loads(ns_path.read_text())
    locale_name = TARGETS[locale]
    prompt = build_prompt(locale_name, ns_name, en_bundle)

    print(f"  → {locale}/{ns_name}.json ({len(en_bundle)} keys) ... ", end="", flush=True)
    t0 = time.time()
    raw = call_ollama(prompt)
    dt = time.time() - t0
    print(f"{dt:.1f}s", end=" ")

    out_dir = OUT_DIR / locale
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{ns_name}.json"
    raw_path = out_dir / f"{ns_name}.json.raw"

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raw_path.write_text(raw)
        print(f"INVALID JSON ({e}) — raw saved to {raw_path.relative_to(REPO)}")
        return False, f"invalid json: {e}"

    issues = validate(en_bundle, parsed)
    out_path.write_text(json.dumps(parsed, indent=2, ensure_ascii=False) + "\n")
    if issues:
        print(f"WROTE with {len(issues)} warning(s):")
        for issue in issues:
            print(f"      ⚠ {issue}")
        return False, "; ".join(issues)
    print("OK")
    return True, ""


def main():
    if not EN_DIR.exists():
        print(f"FATAL: {EN_DIR} missing", file=sys.stderr)
        sys.exit(1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    ns_files = sorted(EN_DIR.glob("*.json"))
    print(f"Translating {len(ns_files)} namespaces × {len(TARGETS)} locales via {MODEL}")
    print(f"Staging output: {OUT_DIR.relative_to(REPO)}")
    print()

    # Per-locale loop (rather than per-namespace) keeps Ollama warm on a single
    # model for the whole locale pass — first call is the cold one.
    summary = []
    for locale in TARGETS:
        print(f"[{locale}]")
        ok_count = 0
        warn_count = 0
        for ns_path in ns_files:
            ok, msg = translate_namespace(locale, ns_path)
            if ok:
                ok_count += 1
            else:
                warn_count += 1
        summary.append((locale, ok_count, warn_count, len(ns_files)))
        print()

    print("=" * 60)
    print("SUMMARY")
    for locale, ok, warn, total in summary:
        print(f"  {locale}: {ok}/{total} clean, {warn} with warnings")
    print()
    print(f"Review staging output at: {OUT_DIR.relative_to(REPO)}")
    print("When happy, promote with: cp -r scripts/i18n-staging/* src/locales/")


if __name__ == "__main__":
    main()
