# Nabaperks Design System Import

This folder records the retired downloaded **Nabaperks Design System (Honey &
Ink)** package boundary.

## Layout

- The checked-in `source/` mirror was removed after its ideas were translated
  into production tokens and components.
- Runtime implementation references now live in `DESIGN.md`, `app/globals.css`,
  `components/brand`, `components/customer`, and route composition.

## Import Rules

- Treat `DESIGN.md` and the runtime components as the package authority.
- Keep app implementation changes in normal repo files: `app/`, `components/`,
  `lib/`, and `supabase/`.
- Preserve core `components/ui/*` shadcn primitives; move Wet Ink styling into
  tokens, wrappers, or usage sites first.
- Do not reintroduce generated design-tool byproducts or downloaded source
  mirrors as tracked repo content.
