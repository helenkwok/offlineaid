# Product

## Users

OfflineAid serves three user types, with the **crisis lay user** as the brutal-test persona — every design optimises for their context, and the other personas inherit that clarity.

- **Crisis lay user (brutal test)** — A non-technical person in a connectivity-dead or unsafe environment: disaster zone, remote field, conflict area, evacuation. Stressed, possibly one-handed, possibly low light or glare. Job: get an accurate, source-grounded answer to a survival-relevant question (water purification ratio, wound care, evacuation route) without ever touching the internet.
- **Field professional / first responder** — Aid worker, medic, ranger. Trained, tolerates density, expects verifiable sources and perf transparency. Job: confirm a procedure or look up a reference faster than flipping a paper manual.
- **Privacy / offline enthusiast** — Tech-comfortable user choosing on-device LLM for privacy and audit-ability, not crisis. Job: get useful answers from local knowledge packs with full inspectability of what the model saw.

## Product Purpose

A person in a connectivity-dead or network-unsafe environment can get useful, accurate local information through natural conversation — without ever touching the internet. Knowledge arrives as self-contained `.oapack.zip` packs from trusted sources; all inference, retrieval, and perception runs on-device. Success = the user gets the answer **and** can see exactly which source the answer came from, even when the network is gone.

## Brand Personality

**Honest · dense · unfussy.**

- **Voice:** Direct, concrete, no hedging. "8 drops per gallon, wait 30 minutes." Not "you might want to consider..."
- **Tone:** Calm authority — *"this still works."* Quiet competence in the face of a stressful context. No panic-tinted UI, no urgency theatre, no reassurance fluff.
- **Posture:** Show the source. Show the perf number. Trust the user to read it.

## Anti-references

What this should explicitly NOT look like:

- **Gamified onboarding** — streaks, XP bars, confetti, "you're on a roll!" copy. Trivialises a serious-context tool.
- **Mascot UIs** — friendly cartoon companion, anthropomorphised assistant avatar. Wrong register for a field tool; signals toy.
- **Dopamine-loop patterns** — pulsing notification dots, "new!" badges, engagement nags. The user opens this when they need an answer, not for a session.
- **Generic AI-chatbot shells** — purple/blue AI gradient chrome, "✨ AI thinking..." sparkles, glassmorphism, hero-metric tiles. Looks like every LLM wrapper; reads as untrustworthy.

## Reference Points

Best-tool references that capture the right register:

- **Garmin inReach** — field utility, tiny screen, dense info, no decoration. The trust comes from the tool *working* when nothing else does.
- **Apple Health summary** — calm summarisation of dense data, restrained palette, generous typography hierarchy without ornamentation.
- **ICRC field apps** — domain-serious tone, source-citation built into the experience, accessibility taken seriously.

## Design Principles

1. **Show the source, every time.** Every retrieval-grounded answer is followed by the cite. The source attribution is not decoration — it's the verification primitive that makes an offline answer trustworthy.
2. **Restraint as confidence.** A single-hue accent ramp; neutral chrome; no flourish. The interface earns trust by *not* trying to.
3. **Density without clutter.** Field-manual information density, but with hierarchy that lets a stressed reader scan first and read second. Filename out-weights snippet; primary action out-weights secondary.
4. **Crisis-grade reachability.** Every primary action is reachable one-handed, on a phone, in glare, with reduced motion. If it doesn't work in the worst context, it doesn't ship.
5. **Perf transparency.** TTFT and tok/s are visible because the user (especially the field pro) needs to know whether the device is keeping up. Honesty about latency beats hiding it.

## Accessibility & Inclusion

**WCAG AA floor + crisis-context extensions:**

- Contrast ratios meet WCAG AA in light AND dark, including the red accent ramp on tinted surfaces (red-600 on red-50; red-400 on red-950).
- **Reduced-motion respected** — all transitions and any incidental animation gate on `prefers-reduced-motion`. No motion-only state communication.
- **High-contrast OS modes** — light/dark switch maps to system; tokens scale legibly to forced-high-contrast.
- **One-handed reach** — primary actions (send, source-tap, tab switch) sit in the lower phone hemisphere; large tap targets (≥44×44pt) on every interactive element.
- **Glare / low-light tolerant** — high-contrast text on muted surface, no thin-weight body text, no decorative gradients that lose legibility outdoors.
- **Sunlight-readable mode (open question, Phase 11.1+)** — direct sunlight on an OLED phone routinely drops effective contrast by 30–50%. WCAG AA passes are insufficient at noon in open desert / arctic snow / sun-baked dashboard contexts. Two interventions to evaluate: (a) honour `prefers-contrast: more` to bump body text to `text` (≥7:1) and thicken every border; (b) explicit in-app "Sunlight mode" toggle that swaps to a hard-contrast palette (pure white bg, pure black text, red-700 fill) and disables the warm-charcoal dark mode in favour of high-contrast inverted. Light mode in particular needs validation under real glare — current `neutral-100` bg may wash out outdoors.
- **Voice + audio paths** — Audio Scribe lane gives text-input-impaired users an alternative input channel.
