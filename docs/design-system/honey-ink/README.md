# Nabaperks Design System Import

This folder holds the repo-owned copy of the downloaded **Nabaperks Design
System (Honey & Ink)** package.

## Layout

- `source/` — Verbatim source mirror of the downloaded design-system package.
  Keep this tree intact so the packaged HTML, CSS, JS, template, and UI-kit
  relative links keep working.
- `source/tokens/` — Portable Wet Ink CSS tokens and component utility classes.
- `source/components/` — React component references, type declarations,
  prompt notes, and specimen cards.
- `source/guidelines/` — Brand, colour, type, spacing, motion, and shape cards.
- `source/templates/` — Copy-to-start design component templates.
- `source/ui_kits/` — Customer, marketing, and merchant HTML reference kits.
- `source/v2/` — Living v2 prototype reference.

## Import Rules

- Treat `source/readme.md` and `source/SKILL.md` as the package authority.
- Do not edit generated files such as `source/_ds_bundle.js` by hand.
- Keep app implementation changes in normal repo files: `app/`, `components/`,
  `lib/`, `supabase/`, and `tests/`.
- Preserve core `components/ui/*` shadcn primitives; move Wet Ink styling into
  tokens, wrappers, or usage sites first.
- `.thumbnail`, `scraps/`, and `uploads/` are intentionally excluded because
  they are transient design-tool byproducts, not implementation references.
