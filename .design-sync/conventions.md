# Wet Ink — building with this design system

Wet Ink is the design language of **Nabaperks**, a loyalty stamp-card product for
independent counter-service venues (coffee shops, cafés). The look is
**riso-print / rubber-stamp**: warm paper, flat spot inks, **hard offset shadows
(never blurred)**, and a slight hand-stamped tilt. Build on-brand by composing
these real components and styling layout glue with the semantic token utilities
below — never reach for raw hex or generic grays.

## Setup & wrapping

- **Import the design system's `styles.css`** once at the root. It carries the
  Wet Ink tokens, the brand fonts (**Bricolage Grotesque** for text/headings,
  **Space Mono** for uppercase meta), and the compiled component CSS. Without it
  everything renders unstyled.
- **Most components are self-contained** — no provider needed. Two exceptions:
  - `Sidebar` and its parts must be wrapped in **`SidebarProvider`** (it reads
    context via `useSidebar`; unwrapped it throws).
  - `Toaster` is the toast _region_ — mount it **once** near the root. Fire
    notifications imperatively with `toast(...)` from the `sonner` package
    (the trigger is not part of this bundle; the region is).
- **Dark mode**: add the `dark` class to an ancestor (`<html class="dark">`). The
  tokens below automatically resolve to their dark values; no theme provider.

## Styling idiom — Tailwind v4 utilities on Wet Ink tokens

Style with these **semantic** utility families (all verified in the shipped CSS).
Prefer component props first; use these for your own layout glue.

| Purpose                 | Utilities                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Surfaces                | `bg-paper`, `bg-paper-deep`, `bg-card`, `bg-secondary`, `bg-muted`, `bg-accent`                                    |
| Spot inks (fills)       | `bg-primary`/`bg-stamp` (vermillion), `bg-reward` (leaf green), `bg-seal` (sun amber), `bg-destructive`            |
| Text                    | `text-ink`, `text-ink-soft`, `text-foreground`, `text-muted-foreground`, `text-primary` (+ `*-foreground` on inks) |
| Borders                 | `border-border`, `border-input`, `border-ink`                                                                      |
| **Hard offset shadows** | `shadow-xs`, `shadow-sm`, `shadow-md` — Wet Ink's signature, **never** `shadow-lg`-blur or `drop-shadow`           |
| Type                    | `font-sans`/`font-heading` (Bricolage Grotesque), `font-mono` (Space Mono — uppercase meta/eyebrows)               |
| Radius                  | `rounded-full` (pills, stamps) or arbitrary `rounded-[min(var(--radius-4xl),24px)]` for cards                      |

Domain accent meaning is consistent: **vermillion = primary/stamp**, **leaf
green = reward/ready**, **sun amber = sealed/mystery**. Keep redemptions green,
mysteries amber, primary actions vermillion.

## Where the truth lives

- Each component ships a **`<Name>.prompt.md`** (usage + examples) and
  **`<Name>.d.ts`** (`<Name>Props` API contract) — read these before composing.
- **`DESIGN.md`** (in guidelines) is the full token/typography/spacing spec.
- Read the bound **`styles.css`** for the exact token values.

## Idiomatic example

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StampGrid,
  Button,
} from "<design-system>"

// A member card: real components for structure, Wet Ink tokens for glue.
;<Card className="max-w-md">
  <CardHeader>
    <CardTitle>Bridge Street Coffee</CardTitle>
    <CardDescription className="font-mono text-xs text-ink-soft uppercase">
      7 of 8 stamps · 1 to go
    </CardDescription>
  </CardHeader>
  <CardContent className="grid gap-4">
    <StampGrid current={7} total={8} rewardSlot="locked" venueInitials="BS" />
    <Button variant="reward" disabled>
      Redeem free flat white
    </Button>
  </CardContent>
</Card>
```
