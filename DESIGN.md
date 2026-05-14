---
name: OfflineAid
description: An offline crisis & emergency assistant that runs entirely on-device and shows its sources.
colors:
  text-light: "#111827"
  text-dark: "#f8fafc"
  text-secondary-light: "#4b5563"
  text-secondary-dark: "#a8a29e"
  background-light: "#f5f5f4"
  background-dark: "#0a0a0a"
  surface-element-light: "#ffffff"
  surface-element-dark: "#171717"
  surface-muted-light: "#f5f5f4"
  surface-muted-dark: "#262626"
  surface-accent-light: "#fef2f2"
  surface-accent-dark: "#450a0a"
  border-light: "#e7e5e4"
  border-dark: "#404040"
  red-600: "#dc2626"
  red-700: "#b91c1c"
  red-400: "#f87171"
  red-300: "#fca5a5"
  red-50: "#fef2f2"
  red-950: "#450a0a"
  warning-text-light: "#9a3412"
  warning-text-dark: "#fed7aa"
  success-text-light: "#166534"
  success-text-dark: "#4ade80"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  bodyEmphasis:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.6px"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
components:
  button-primary:
    backgroundColor: "{colors.red-600}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  button-primary-pressed:
    backgroundColor: "{colors.red-700}"
    textColor: "#ffffff"
  button-neutral:
    backgroundColor: "{colors.text-light}"
    textColor: "{colors.surface-element-light}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-light}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary-light}"
    rounded: "{rounded.pill}"
    padding: "10px 12px"
    height: "44px"
  card-neutral:
    backgroundColor: "{colors.surface-element-light}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-warn:
    backgroundColor: "{colors.surface-muted-light}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-error:
    backgroundColor: "{colors.surface-accent-light}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-source:
    backgroundColor: "{colors.surface-accent-light}"
    textColor: "{colors.red-700}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  toggle-on-track:
    backgroundColor: "{colors.red-600}"
    rounded: "{rounded.pill}"
  toggle-off-track:
    backgroundColor: "#d6d3d1"
    rounded: "{rounded.pill}"
---

# Design System: OfflineAid

## 1. Overview

**Creative North Star: "The Field Manual"**

OfflineAid looks and behaves like a printed field manual that also happens to talk back. The interface is a calm authority in the user's hand at the worst moment of their week: a stressed lay user in a dead zone, a medic confirming a wound-care procedure, an aid worker triangulating a route. Every pixel inherits the discipline of Garmin inReach, Apple Health summary, and ICRC field apps — dense information, restrained palette, generous hierarchy, no decoration. The system earns trust by *not trying to*.

The chrome is warm-charcoal in dark and warm-stone in light, never blue-purple navy and never cool-cast greys. A single saturated red carries the entire accent system: it appears on the primary action, the source-citation chip, the failure tier-3 strip, and almost nowhere else. The rest of the surface is neutral on purpose, so red, when it appears, *means something*. The interface is not afraid of empty space and not afraid of monospace numbers. Diagnostic data (TTFT, tok/s, file paths, hashes) shows in `ui-monospace` because the field professional reads it like instrument output, not like marketing copy.

This system explicitly rejects the SaaS clichés that pollute the LLM-wrapper space: no purple-blue AI gradients, no `✨ AI thinking` sparkles, no glassmorphism, no hero-metric tiles, no gamified streaks, no mascot avatars, no engagement nags. Honesty about latency beats hiding it. Source attribution is not decoration: it is the verification primitive that makes an offline answer trustworthy.

**Key Characteristics:**
- Single-hue red accent ramp (red-600 fill, red-700 strong, red-400/300 text on dark, red-50/950 tinted surfaces).
- Warm-stone neutrals in light, warm-charcoal in dark. No cool greys, no navy.
- 44pt minimum touch target on every interactive element. One-handed reach matters.
- Monospace for diagnostic data; system sans for everything else.
- Pill-shaped buttons (radius 999); rounded cards (radius 12 or 16).
- Flat by default. Depth comes from tonal layering, not shadows.
- WCAG AA in light AND dark, including the red ramp on tinted surfaces.

## 2. Colors

A restrained two-tone scheme: warm-neutral chrome plus a single-hue red accent ramp. Red appears on ≤10% of any screen at rest and is reserved for action, attribution, and tier-3 failure.

### Primary
- **Field Red 600** (`#dc2626`): The single accent fill. Used on the primary CTA, send button, toggle "on" track, source-chip border, tier-2/tier-3 surface accents, and the tier-3 banner strip. This is the *only* color in the system that earns saturation.
- **Field Red 700** (`#b91c1c`): The pressed/strong variant. Used on primary buttons in their pressed state, the source-chip text in light mode, and the `accentMutedText` slot.

### Secondary (text-on-dark only)
- **Field Red 400** (`#f87171`): Text or icon weight on dark surfaces. Clears WCAG AA on `#0a0a0a`. Forbidden as a fill.
- **Field Red 300** (`#fca5a5`): Muted text or link color on dark surfaces.

### Tertiary (tinted surfaces)
- **Red 50 Tint** (`#fef2f2`): Light-mode tinted surface for `surfaceAccent`, `surfaceInfo`, source-chip background.
- **Red 950 Tint** (`#450a0a`): Dark-mode counterpart, same roles.

### Neutral
- **Ink** (`#111827` light / `#f8fafc` dark): Body text and primary headings.
- **Slate** (`#4b5563` light / `#a8a29e` dark): Secondary text, supporting copy.
- **Stone** (`#f5f5f4` light / `#0a0a0a` dark): App background. Warm-neutral, never cool grey.
- **Element Surface** (`#ffffff` light / `#171717` dark): Cards, input chrome, sheets.
- **Hairline Border** (`#e7e5e4` light / `#404040` dark): 1px structural borders, dividers.

### Status (used sparingly)
- **Warning Text** (`#9a3412` light / `#fed7aa` dark): Reserved for the warning banner; never used on the perf bar, never on user bubbles.
- **Success Text** (`#166534` light / `#4ade80` dark): "Ready" state copy on the chat empty state when a model is loaded.

### Named Rules

**The Single Voice Rule.** One hue carries the entire accent system. There is no secondary accent, no second saturated color, no "info blue" or "success green" used decoratively. Status colors are text-only and appear only on dedicated status surfaces.

**The 10% Rule.** At rest, on any given screen, red occupies less than 10% of the visible surface area. Red dominance is a tier-3 failure-state signal. If a non-failure screen looks red-heavy, you have a regression.

**The Dual-Red Role Rule.** `red-600` and `red-700` are *fill* colors. `red-400` and `red-300` are *text/icon* colors on dark surfaces only. Never invert. `red-400` as a fill is forbidden. `red-600` as text on `#0a0a0a` is forbidden (fails AA).

**The No Cool-Grey Rule.** Neutrals tint warm: `stone-*` (Tailwind) family for chrome, `gray-900` for ink. No `slate-*` backgrounds, no `zinc-*`, no navy. The warmth is the trust signal.

**The Source-Chip Rule.** Source citations get the only "red on neutral" treatment in the body: `surfaceAccent` background, `red-700` text, pill shape. The source IS the verification primitive.

## 3. Typography

**Display Font:** System sans (`system-ui` / `-apple-system` / `Roboto`).
**Body Font:** Same system sans, used at every weight from 400 to 800.
**Mono Font:** `ui-monospace` (`SF Mono` on iOS, `monospace` on Android). Reserved for diagnostic data and field-pro readouts.

**Character:** Honest, dense, unfussy. The system font carries the load because it inherits the reader's OS accessibility settings (Dynamic Type, font scaling, OS-level font preference). Mono carries diagnostic data so the field professional reads it like instrument output, not marketing copy.

### Hierarchy

- **Display** (weight 800, 28px, line-height 1.1, letter-spacing -0.5px): App brand mark on the chat empty state. Used once per cold start.
- **Headline** (weight 700, 18px, line-height 1.25): Top-of-screen titles — `Models`, `Knowledge Packs`, `Audio Scribe` heading. Sits below the native stack header.
- **Title** (weight 700, 16px, line-height 1.25): Card titles, `Failure*` titles, list-item primary text, settings rows.
- **Body** (weight 400, 14px, line-height 1.5 / 21px): Default body copy. Failure-state body, card descriptions, settings notes.
- **Body Emphasis** (weight 600, 13px, line-height 1.4): Status messages on the AmbientBanner, link rows, chat-empty-state taglines.
- **Label** (weight 700, 11px, letter-spacing 0.6px, UPPERCASE): Section labels — `SECTIONS`, `ON-DEVICE PACKS`, `Notes`. Quiet structural signposts.
- **Mono** (weight 400, 12px, line-height 1.4): Diagnostic rows in FailureCritical, perf data, file paths, hashes, model IDs.

### Named Rules

**The Mono-for-Truth Rule.** Anything the field pro will read as data — TTFT, tok/s, file path, hash, model identifier, byte count, error code — uses mono. Anything the user reads as language uses sans.

**The No Mono Body Rule.** Mono is for data, never for prose. If a sentence is in mono, it is a regression. AmbientBanner's *message* is sans-emphasis; only its *progress* readout is mono.

**The Density Rule.** Body line-height is 1.5 (21px on 14px). Tighter than 1.4 reads as cramped instructions; looser than 1.6 reads as marketing copy. The 1.5 ratio is what field manuals and Apple Health both land on.

## 4. Elevation

**Flat by default.** Depth in OfflineAid comes from tonal layering, not box-shadows. The app surface (`background`) sits below the element surface (`backgroundElement`), which sits below tinted action surfaces (`surfaceAccent`). Each step is a tonal shift in the warm-neutral ramp, not a drop shadow.

There is no shadow vocabulary. Cards have a 1px hairline border in `border` (or `borderStrong` for an emphasized row). The only motion-on-elevation is press feedback (`opacity: 0.85` on a `Pressable`). No lift, no scale, no shadow expansion.

### Named Rules

**The No-Shadow Rule.** No `box-shadow`. No drop shadows on cards, sheets, modals, or floating action buttons. Depth is communicated by tonal layering and 1px borders. If you see a shadow, it is a regression.

**The Tonal-Step Rule.** Stack at most three tonal layers visible at once: `background` → `backgroundElement` → `surfaceAccent` (or `surfaceMuted`). Four layers is a cluttered surface; rework.

**The Press-Only Motion Rule.** The only state-driven visual change at rest is `opacity: 0.85` on press. No hover transitions (touch-first). No focus rings beyond the platform default.

## 5. Components

Every interactive component lives at ≥44pt minimum touch target. Glove- and panic-tolerant by construction.

### Buttons

- **Shape:** Pill (`borderRadius: 999`).
- **Primary (red fill):** `backgroundColor: red-600 (#dc2626)`, `color: #ffffff`, padding `10px 14px`, `minHeight: 44`. Used for the dominant action: send, "Go to Models →", FailureError primary, FailureCritical *repair*.
- **Neutral primary (inverted):** `backgroundColor: text (#111827 / #f8fafc)`, `color: backgroundElement`, same shape. Used for FailureWarn primary and FailureCritical *fallback* — high-contrast inversion that structurally cannot be confused with a red action.
- **Secondary (bordered):** `backgroundColor: transparent`, 1px `borderColor: border`, `color: text`. Used for FailureCritical *alt*, scribe `Cancel`.
- **Ghost (text-only):** transparent background, `color: textSecondary`, padding `10px 12px`. Quiet tertiary actions.
- **Ghost-Danger:** transparent background, `color: accentMutedText` (red-700 light / red-300 dark). Reserved for the demoted ungrounded-generation action in FailureWarn — text-only red so it is *available* but never the obvious choice.
- **Pressed:** `opacity: 0.85`. No color shift.
- **Touch target:** `minHeight: 44`, `justifyContent: 'center'`. Non-negotiable.

### Chips

- **Source chip (signature):** `surfaceAccent` background, `red-700` text in light mode, pill shape, padding `4px 10px`. The verification primitive made tactile.
- **Header status chip (`No model`):** `surfaceMuted` background, `text` color, pill shape. Quiet status, never red.

### Cards / Containers

- **Corner Style:** 12 or 16px radius. 12 for inline cards (settings rows, list items); 16 for failure-state cards and empty-state cards.
- **Background:** `backgroundElement` for neutral cards, `surfaceMuted` for FailureWarn (recoverable advisory), `surfaceAccent` for FailureError (broken), `backgroundElement` *with a red strip banner* for FailureCritical (hard stop).
- **Shadow Strategy:** None. See `Elevation`.
- **Border:** 1px hairline, `border` color. `buttonPrimary` (red-600) only on FailureError per the contract.
- **Internal Padding:** 16 (Spacing.three) for card body; 24 (Spacing.four) for spacious empty states.
- **Nesting:** Forbidden. A card inside a card is always a regression.

### Inputs / Fields

- **Style:** `inputBackground` background, 1px `inputBorder` (`#cbd5e1` light / `#404040` dark), `borderRadius: 12`, `inputPlaceholder` color for placeholder.
- **Focus:** Platform default. No custom glow, no custom border-color shift.
- **Toggle:** Track is `red-600` when on, `#d6d3d1` (light) / `#404040` (dark) when off. White thumb. Pill-shaped track.

### Navigation

- **Native bottom tab bar** (Expo Router NativeTabs) with five entries: Chat, Camera, Explore, Map, Settings. Platform-native icons (`sf=` on iOS, `md=` on Android Material).
- **Active tint:** `text` color (high contrast). Inactive: `textMuted`. No red on the tab bar; red is reserved for action.
- **Push chrome:** Native stack header on all top-level pushes (`Models`, `Packs`, `Audio Scribe`, `General`, smoke). Header back affordance is the platform default chevron + `Back` label. The screen below begins at `paddingTop: 12` because the native header already absorbs the top safe-area inset.

### Failure-State Ladder (signature)

A three-tier system from Sketch 002. Tier escalates the surface treatment but the action grammar stays consistent.

- **Tier 1 — FailureWarn (recoverable advisory):** Neutral `surfaceMuted` card. Icon circle (32×32, hairline border) + title + body + meta. Primary action is *neutral* (inverted ink); cannot accept a red primary by structure. Ghost-danger slot exists for demoted ungrounded actions.
- **Tier 2 — FailureError (broken, action required):** `surfaceAccent` (red-50/950) tinted card with `red-600` 1px border. Primary action is `red-600` fill.
- **Tier 3 — FailureCritical (hard stop, model unusable):** Neutral card with a full-width `red-600` banner strip across the top (NOT a side stripe). Body contains a mono diagnostic-row block (definition list with `minWidth: 96, maxWidth: 40%` keys for i18n). Action order is fixed: **fallback first** (neutral, lay-user safe path), **repair second** (red, field-pro action), **alt third** (bordered). Dev-asserts that only one Tier-3 is mounted at a time.
- **AmbientBanner (NOT a failure tier):** `surfaceMuted` strip at the top of the index layout. Pulsing dot (animated opacity, native-driver, gates on `prefers-reduced-motion`). System-state communication only — model loading progress, indexing, etc. Never red. `hitSlop` on actions because the bar is dense.

## 6. Do's and Don'ts

### Do:

- **Do** ship `red-600` (`#dc2626`) for the single fill accent and `red-700` (`#b91c1c`) for its pressed state. One hue carries the system.
- **Do** use `red-400` and `red-300` for text/icon weight on dark surfaces only.
- **Do** keep red below 10% of any non-failure screen.
- **Do** put diagnostic data — TTFT, tok/s, file paths, hashes, model IDs — in `ui-monospace`.
- **Do** show the source. Every retrieval-grounded answer is followed by a source chip. Source attribution is the verification primitive, not decoration.
- **Do** enforce `minHeight: 44` on every `Pressable`, `Button`, and `TouchableOpacity`. Crisis-grade reachability is non-negotiable.
- **Do** gate every animation on `useReducedMotion()` (the `AccessibilityInfo.isReduceMotionEnabled` listener pattern in `src/components/failure-state/use-reduced-motion.ts`).
- **Do** use tonal layering (`background` → `backgroundElement` → `surfaceAccent`) for depth. Hairline 1px borders for separation.
- **Do** route every color through theme tokens (`useTheme()` + `createStyles(theme)`). Memoize the StyleSheet via `useMemo`.
- **Do** use the system sans for prose (inherits Dynamic Type and OS font scaling).
- **Do** put primary actions in the lower hemisphere of the screen for one-handed reach.
- **Do** show the perf number. Honesty about latency beats hiding it.

### Don't:

- **Don't** introduce a second saturated accent. There is no "info blue", no "success green" used decoratively, no purple, no orange. Status colors are text-only on dedicated status surfaces.
- **Don't** use `red-400` as a fill. It exists ONLY for text/icon AA on dark.
- **Don't** use `red-600` as text on `#0a0a0a`. Fails AA.
- **Don't** put any red on `bubbleUser`. The user's own utterance is neutral, not panic-tinted.
- **Don't** put any red on the perf bar. Perf is diagnostic, not alert.
- **Don't** hardcode hex values. Route every color through theme tokens. (Recently caught: `#b45309` in PacksScreen — fixed.)
- **Don't** use side-stripe borders (`borderLeft: 4px solid …`). Tier-3's red banner is a *full-width top strip*, not a side stripe. If you find yourself reaching for a colored 4px border, rewrite the element.
- **Don't** add box-shadows. The system is flat. Depth is tonal.
- **Don't** nest cards. A card inside a card is always wrong.
- **Don't** use `#000` or `#fff` raw. Background ink is `#111827` / `#f8fafc`; surfaces tint warm.
- **Don't** ship gamified onboarding — no streaks, no XP bars, no confetti, no "you're on a roll!" copy. Trivialises a serious-context tool.
- **Don't** ship mascot UIs. No friendly cartoon companion, no anthropomorphised AI avatar. Wrong register for a field tool.
- **Don't** ship dopamine-loop patterns — pulsing notification dots used decoratively, "new!" badges, engagement nags. The user opens this for an answer, not for a session. (AmbientBanner's pulsing dot is *system-state*, gated on reduced-motion, never decorative.)
- **Don't** ship generic AI-chatbot shells. No purple/blue AI gradient chrome, no `✨ AI thinking…` sparkles, no glassmorphism, no hero-metric tiles. Looks like every LLM wrapper; reads as untrustworthy.
- **Don't** use em-dashes in user-facing copy. Use commas, colons, semicolons, or periods.
- **Don't** use mono for prose. Mono is for instrument output.
- **Don't** ship motion-only state communication. If a state changes, it must be communicated by color, position, or text — not animation alone.
- **Don't** use cool-cast greys (`slate-*`, `zinc-*`) or navy. The neutrals tint warm. Warmth is the trust signal.
- **Don't** decorate the source chip. Pill, tinted background, red-700 text. Nothing else. The chip *is* the design.
