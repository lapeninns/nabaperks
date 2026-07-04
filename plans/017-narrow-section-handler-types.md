# Plan 017: Narrow `Section`/`ContrastBand` prop types to what actually forwards

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- components/layout/section.tsx components/layout/contrast-band.tsx components/motion/wet-ink.tsx`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (dormant — no current caller passes handlers)
- **Depends on**: none
- **Category**: bug (latent type/runtime mismatch)
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`Section` (a server component) advertises the **full** `<section>` prop surface
via `ComponentPropsWithoutRef<"section">`, then spreads those props into
`WetInkRise`, which only forwards a hand-listed subset of structural attributes.
So a handler like `onClick`/`onScroll` passed to `Section` is silently dropped (or
fails at the RSC boundary), while the same handler passed to `ContrastBand`
lands on its outer `<section>` and works — an inconsistency. No current caller
passes handlers, so this is a dormant trap: the types promise something the
runtime doesn't honor. Narrowing the public types to what forwards makes the
contract truthful and fails at compile time instead of silently.

## Current state

```ts
// components/layout/section.tsx:33-49
type SectionProps = {
  as?: "section" | "div"
  size?: SectionSize
  width?: SectionWidth
  entrance?: boolean
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<"section">, "children">   // <-- advertises onClick etc.

export function Section({ as: Tag = "section", ..., ...props }: SectionProps) {
  // ...
  if (entrance) {
    return (<WetInkRise as={Tag} inView distance={12} className={sectionClassName} {...props}>{children}</WetInkRise>)
  }
  // non-entrance branch renders a plain <Tag> (props forwarded normally there)
}
```
- `WetInkRise` (`components/motion/wet-ink.tsx`) forwards only a hand-listed set
  (per its `WetInkForwardProps`: `id`, `role`, `tabIndex`, `title`, `aria-*`,
  `data-*`, plus `className`/`style`) — **verify the exact list in that file**
  before narrowing so you match it precisely.
- `ContrastBand` (`components/layout/contrast-band.tsx:33-56`) has a similar prop
  shape but (per the finding) does not forward `...props` into `WetInkRise` in the
  same way, so a handler on it currently works — the inconsistency to resolve.

## Commands you will need

| Purpose   | Command          | Expected |
|-----------|------------------|----------|
| Typecheck | `pnpm typecheck` | exit 0   |
| Lint      | `pnpm lint`      | exit 0   |
| Build     | `pnpm build`     | exit 0   |
| Micro-specs | `pnpm test:micro-specs` | pass |

## Scope

**In scope**:
- `components/layout/section.tsx`
- `components/layout/contrast-band.tsx`
- Optionally a small shared passthrough-props type (co-locate in
  `components/motion/wet-ink.tsx` next to `WetInkForwardProps`, exported).

**Out of scope**:
- `WetInkRise`'s runtime forwarding behavior (do not change what it forwards;
  align the *types* to it).
- Marketing section call sites (none pass handlers; do not add features).

## Git workflow

- Branch: `advisor/017-section-prop-types`
- Commit: `fix(layout): type Section/ContrastBand to what WetInkRise forwards`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the forwarded set

Open `components/motion/wet-ink.tsx` and record the exact prop keys `WetInkRise`
forwards to `m.div`/`<Tag>` (the `WetInkForwardProps` type). This is the source
of truth for the narrowed public type.

### Step 2: Narrow `SectionProps`

Replace `Omit<ComponentPropsWithoutRef<"section">, "children">` with a type that
includes only the forwarded structural attributes (e.g. `id`, `className`,
`style`, `role`, `tabIndex`, `title`, `aria-*`, `data-*`) — reuse/export a shared
`WetInkPassthroughProps` type from `wet-ink.tsx` so `Section` and the wrapper
can't drift. Keep `as`/`size`/`width`/`entrance`/`children`.

### Step 3: Align `ContrastBand`

Give `ContrastBand` the same narrowed prop type so both components expose an
identical, truthful contract (whether or not it currently forwards handlers, its
public type should match `Section`'s).

**Verify**:
- `pnpm typecheck` → exit 0 (if a real caller passed a now-removed prop, this is
  where it surfaces — see STOP conditions).
- `pnpm lint && pnpm build` → exit 0.
- `pnpm test:micro-specs` → pass.

## Test plan

- No new runtime test (type-level change). The compiler is the test: `pnpm
  typecheck` must stay green, proving no caller relied on a dropped prop.
- Verification: `pnpm typecheck`, `pnpm build`, `pnpm test:micro-specs` pass.

## Done criteria

ALL must hold:

- [ ] `SectionProps` no longer extends the full `ComponentPropsWithoutRef<"section">`;
      it exposes only the attributes `WetInkRise` actually forwards
- [ ] `ContrastBand` exposes the same narrowed prop type
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:micro-specs` pass
- [ ] No marketing call site was changed (`git status`) — or, if typecheck forced
      one, it's a genuine prior misuse now caught (report it)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- `pnpm typecheck` reveals a real caller passing a handler/attribute to `Section`
  that the runtime was silently dropping — report the callsite (it's a latent bug
  this plan just surfaced; the caller needs a real fix, don't just re-widen the type).
- `WetInkRise`'s forwarded set is broader/narrower than the finding states — match
  the actual code, not this excerpt.

## Maintenance notes

- Keep the public prop type derived from `WetInkForwardProps` so future changes to
  what `WetInkRise` forwards automatically update `Section`'s contract.
- Reviewer: this should be a types-only diff with no runtime change.
