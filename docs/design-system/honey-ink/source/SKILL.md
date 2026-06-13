---
name: nabaperks-design
description: Use this skill to generate well-branded interfaces and assets for Nabaperks, the "Wet Ink" UK no-app QR loyalty platform — for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Nabaperks — Wet Ink (v2)

Read `readme.md` in this skill for the full design guide, then explore the other files.

**Quick orientation**
- **Brand:** riso-print / rubber-stamp tactility for UK counter-service loyalty.
  The core verb — *stamping* — is the whole visual language.
- **Colour:** warm paper (`#F6F1E6`) + warm ink (`#211C16`) + flat spot inks:
  **vermillion** action/stamp (themeable accent), cobalt info, leaf success, sun seal.
- **Type:** Bricolage Grotesque (spoken voice, headings always 800) + Space Mono
  (printed voice: IDs, codes, dates, eyebrows, feeds).
- **Shape:** 10px radius, 2px ink borders, **hard offset shadows (never blurred)**;
  circles reserved for the stamp family, always rotated -6° to -8°.
- **Motion:** the stamp **slam** (380ms overshoot + paper shake), buttons whose
  shadow collapses into the paper on press, one-shot celebration particles.
- **UX doctrine:** value before friction (first stamp before signup; "Keep your
  card", never "register") and the paired-station **counter moment** (customer
  code shown to staff, approval completed at the counter station).
- **Icons:** none — ✱ stamps, ?/✓ seals, status dots, dashed circles. No emoji.

**Token & component entry points**
- Link `styles.css` (it `@import`s everything in `tokens/`, incl. all keyframes).
- Components live in `components/` and bundle to `window.NabaperksDesignSystemHoneyInk_4fb4ef`
  (stable namespace) via the generated `_ds_bundle.js`:
  InkButton, GhostLink, MonoTag/MonoLine, PinPad, OtpBoxes, ReceiptCard/ReceiptRule,
  Sheet, StampRow/StampDisc, ProgressLine, Seal, VenueMark, CelebrationBits.
- Foundation specimens: `guidelines/`. Screen recreations: `ui_kits/`.
  Copy-to-start templates: `templates/`. The living prototype: `v2/`.

**How to work**
- For **visual artifacts** (slides, mocks, throwaway prototypes): copy the assets/tokens
  you need and produce static or interactive **HTML** files. Reuse the `.w-*` classes from
  `tokens/components.css` or the React components from the bundle.
- For **production code**: follow `readme.md`; keep the paper/ink/spot-ink discipline,
  hard shadows, and the en-GB "value before friction" copy rules.
- If the user invokes this skill without guidance, ask what they want to build
  (surface: customer / merchant / marketing? prototype or production? which screens?),
  then act as an expert Wet Ink designer who outputs HTML artifacts or production code.
