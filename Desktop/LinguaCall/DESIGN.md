# DESIGN.md

## Project Reality

This repository currently implements LinguaCall as a browser-based realtime voice product, not a pure telephony-first product.

Preserve the current working shape of the repo.
Do not rewrite the product around telephony assumptions unless explicitly asked.
Do not remove existing multilingual, billing, report, or policy surfaces unless explicitly asked.
If a product document conflicts with the current codebase, prefer the current repository as implementation truth and report the mismatch clearly.

## Read First

Before making UI changes, read these files in order:
1. `/README.md`
2. `/DEPLOY.md`
3. `/docs/product/LinguaCall_PRD_v3.1_scope_locked.md` if present
4. `/docs/engineering/LinguaCall_engineering_task_breakdown_v1.md` if present
5. `/docs/design/design-tokens.md` if present
6. `/docs/design/page-ui-spec.md` if present
7. `/apps/web/README.frontend-context.md` if present

## Design Intent

LinguaCall should feel like:
- a reliable realtime voice learning product
- a calm study tool
- a structured scheduling product
- a readable report system
- a trustworthy payment surface

It must not feel like:
- a generic chatbot clone
- a loud AI demo
- a crypto dashboard
- a game UI
- a developer tool console

## Core Visual Direction

### Base Shell
Use a calm, structured, scheduling-product aesthetic.
Default shell should feel:
- clean
- quiet
- precise
- lightly premium
- mobile-friendly
- trustworthy

This base style applies to:
- login
- phone verification
- home/dashboard
- session setup
- settings
- report list

### Voice Moments
Voice-related moments can feel slightly softer and more atmospheric.
Use that only for:
- realtime session screen
- voice state transitions
- active call/recording indicators
- AI voice identity areas

Do not turn the whole app into an audio-brand landing page.

### Report Reading
Report detail should feel like a study note.
Optimize for:
- reading
- clarity
- correction scanability
- transcript comprehension

### Billing Surfaces
Pricing and billing should feel more rigid and reliable.
Favor:
- clear comparison
- precise copy
- structured cards
- obvious entitlements

## Visual Principles

- Use neutral colors as the default.
- Use one restrained accent color for primary actions.
- Prefer borders over heavy shadows.
- Use whitespace to create hierarchy.
- Avoid visual noise.
- Keep cards purposeful.
- Avoid over-rounding everything.
- Avoid excessive gradients.
- Avoid “AI chrome” aesthetics.

## Typography

Typography should be highly readable.

Use hierarchy like:
- page titles
- section titles
- card titles
- body text
- helper text
- metadata

Rules:
- prioritize legibility over style
- avoid tiny text for important information
- avoid decorative display fonts
- transcript and reports must read comfortably on mobile

## Layout Rules

- Mobile-first
- Desktop-clean
- Strong vertical rhythm
- Clear section grouping
- One obvious primary action per screen when possible

Avoid:
- dense analytics dashboards in Phase 1 flows
- too many cards above the fold
- multi-column clutter on mobile

## Existing Product Surfaces to Preserve

The repo already contains or documents these user-facing surfaces:
- login
- phone verification
- session/realtime voice screen
- billing/payment
- report screen
- privacy policy
- terms page

Do not remove these surfaces by default.
If a phase does not actively use a surface, prefer hiding or feature-gating it over deleting it.

## Phase-Oriented UI Rules

### Phase 1
- EN + OPIC can be the primary visible path if product scope requires it
- keep other existing surfaces hidden or gated rather than removed
- do not add dashboard charts to the home screen unless explicitly requested
- free/trial users must only be able to choose 10-minute sessions
- one-time scheduled callback may exist as a visible option only if product scope requires it

### Phase 2+
- enable richer billing surfaces
- enable broader report actions such as PDF
- enable multilingual visibility only when backed by real config and backend support

## Component Guidance

### Buttons
- primary buttons should be obvious and calm
- secondary buttons should be visually lighter
- destructive buttons should be clear but not loud

### Inputs
- labels must be visible
- helper text belongs below inputs
- validation should be obvious and specific
- never rely on placeholders alone

### Cards
Use cards for:
- session summary
- report summary
- billing plan summary
- scheduled callback summary

Cards should not be purely decorative.

### Status Presentation
Realtime status must be immediately understandable.
Use a compact and consistent system for:
- connecting
- ready
- active
- generating report
- failed

## Realtime Session Screen

This is the one screen allowed to feel slightly more alive.
It should still remain calm.

Priorities:
- clear session state
- readable transcript or voice-state feedback
- obvious primary action to stop/end if needed
- low cognitive load

Avoid:
- noisy waveforms
- full-screen gradients
- flashing effects
- dense debug information in user-facing UI

## Report Screen

Report pages should feel like structured study notes.
Order of emphasis:
1. summary
2. corrections
3. transcript
4. recommendations
5. history/navigation

Do not make transcript look like casual chat bubbles unless the product explicitly asks for that style.

## Billing Screen

Billing pages should optimize for trust and scanability.
Do not use aggressive upsell language or flashy growth tactics.
The UI should make plan differences obvious without feeling manipulative.

## Accessibility

- minimum readable sizing
- strong contrast
- keyboard-friendly interactions where relevant
- mobile readability first
- transcript readability is required

## Engineering Constraints for UI Work

- Do not change API contracts casually.
- Respect current route structure unless explicitly asked to refactor.
- Prefer additive changes over broad rewrites.
- If a product document conflicts with README/DEPLOY/current code, report it before changing architecture.

## Final Rule

When in doubt, choose:
1. clarity
2. trust
3. readability
4. product consistency
5. visual polish

Never choose excitement over clarity.
