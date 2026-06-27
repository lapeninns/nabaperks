# design-sync NOTES — Nabaperks "Wet Ink" DS

Repo-specific gotchas for future syncs. Append as you learn more.

## What this repo is
- **Next.js 16 product app** (`nabaperks`, `private: true`) — NOT a packaged DS.
  No `dist/`, no `main`/`module`/`exports` package entry. Synth-bundle via a
  hand-written scoped entry barrel (`.design-sync/ds-entry.ts`) + `--entry`.
- The design system is **"Wet Ink"** (see `DESIGN.md`): warm paper, flat spot
  inks, hard offset shadows, riso/rubber-stamp tactility. Tailwind v4 +
  shadcn (`style: radix-rhea`), CSS-variable tokens in `app/globals.css`.

## Scope (agreed with user, 2026-06-27)
- Synced surface = **core primitives only**: `components/ui` (20) + `brand` (10)
  + `loyalty` (11) + `data` (3) + `forms` (3) = **47 primary components**.
- Deliberately EXCLUDED: `customer/` `merchant/` `admin/` `auth/` `layout/`
  (shells/navs) `marketing/` `motion/` `seo/` `pwa/`. These are app/feature
  code — 57 files are `'use client'`, 14 use `next/navigation`, plus QR scanner
  (`html5-qrcode`) and Supabase-coupled flows — and would break a static bundle.
- Compound sub-parts (CardHeader, TabsList, SheetContent, SidebarProvider, …)
  are NOT carded but DO ship in the bundle via the entry's `export *`, so the
  design agent can compose them from `window.WetInk.*`.

## Build invariants (do not regress)
- `cfg.srcDir = "components"` is REQUIRED. Default probe order is
  `src | lib | components`; this repo's `lib/` is app utilities (Supabase
  clients etc.) and would be picked first → wrong source root.
- `--node-modules` = repo `node_modules` (react/radix/hugeicons resolve there).
  With `--entry .design-sync/ds-entry.ts`, PKG_DIR walks up to repo root.
- `cfg.tsconfig = "tsconfig.json"` so esbuild resolves `@/* → ./*` (components
  import `@/lib/utils`, `@/components/ui/*`).
- Faithful install needs `CI=true` (pnpm aborts node_modules removal w/o a TTY:
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Also `COREPACK_ENABLE_STRICT=0`.
  Node 24 (`.nvmrc`), pnpm 10.28.0.

## CSS — Tailwind v4 (the load-bearing risk)
- `cfg.cssEntry = ".ds-sync/wetink.css"` is a **generated** file (NOT committed,
  NOT a repo source). Regenerate before every build by compiling Tailwind v4
  against the repo (auto content-detection) so it carries the used utilities +
  the `@theme`/`:root` Wet Ink tokens. `app/globals.css` is the compile INPUT
  (it `@import`s `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css` — the
  latter two resolve via package `exports`, not literal `node_modules/.../tailwind.css`).
- Without this compile, components render UNSTYLED (raw Tailwind classes have no
  CSS). `@tailwindcss/cli` is not installed; `@tailwindcss/postcss@4.3.0` is.

## Fonts (expect [FONT_MISSING] on first validate)
- Families: **Bricolage Grotesque** (sans/heading) + **Space Mono** (mono),
  both Google Fonts. The app loads them via `next/font` → CSS vars
  `--font-bricolage-grotesque` / `--font-space-mono`, so there is NO shipped
  `@font-face` and those vars are undefined in the bundle. Resolve via
  `cfg.extraFonts` (woff2 + @font-face + var defs) when [FONT_MISSING] fires.

## Next-coupled imports in scope (handle in self-heal if they break)
- `components/brand/logo.tsx` imports `next/link` — may error at preview render
  outside a Next app. Shim to a plain `<a>` (custom tsconfig path) if needed.
- `components/ui/sonner.tsx` imports `next-themes` `useTheme` — safe without a
  provider (returns defaults), should not need `cfg.provider`.

## RESOLVED build issues (keep these fixes)
- **next/link poisons the whole IIFE.** `components/brand/logo.tsx` imports
  `next/link`, which drags Next's client runtime (`process.env.__NEXT_*`) into
  the bundle → `ReferenceError: process is not defined` at eval time → the
  ENTIRE `window.WetInk` assignment aborts → all 47 "not a component". Fix: shim
  `next/link` → `<a>` via `.design-sync/shims/next-link.tsx`, mapped in
  `.design-sync/tsconfig.ds.json` (cfg.tsconfig). Bundle dropped 930→767 KB.
- **`@/` directory-barrel imports** (`@/components/brand`, `@/components/motion`,
  used by funnel-chart / receipt-card) must have EXPLICIT non-wild `→ index.ts`
  rules placed BEFORE `@/*` in tsconfig.ds.json — else the esbuild paths plugin
  returns the bare directory and esbuild errors "is a directory".
- **Fonts: file-based only, never data-URI.** The converter's parseFontFaces
  regex requires url() to END in `.woff2`, so data-URI @font-face are silently
  dropped → [FONT_MISSING]. Fix: `.design-sync/gen-fonts.mjs` stages real woff2
  + `wetink-fonts.css` (file url, → cfg.extraFonts) + `wetink-font-vars.css`
  (:root vars, appended to cssEntry by gen-css). 3 faces ship to fonts/.

## Build/regen sequence (RUN IN ORDER each session)
1. `node .design-sync/gen-css.mjs` — Tailwind compile + append font vars → `.ds-sync/wetink.css` (cssEntry).
2. `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle`
3. `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node .ds-sync/package-validate.mjs ./ds-bundle`
   (system Chrome avoids the 200MB playwright chromium download; `playwright` JS pkg installed in .ds-sync with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1).
- gen-fonts.mjs only re-run if fonts change (needs `.next/static/media` from a next build).

## Preview authoring outcomes (47/47 authored + graded good, render check clean)
- `dtsPropsFor` is set for ALL 47 (synth mode emits stub `.d.ts` otherwise — see
  Re-sync risks). Bodies live in config.json; they were transcribed from source
  by the fan-out subagents (their learnings folded here, files deleted).
- **cardMode overrides** (cfg.overrides): `Table` / `DataTable` / `FunnelChart` /
  `ActivityFeed` = `column` (wide); `Sheet` / `Sidebar` = `single` (overlay /
  full-height). Without these they trip [GRID_OVERFLOW].

## Known render edge-cases (triaged — not regressions)
- **Toaster**: imperative — `toast()` lives in the `sonner` pkg, NOT the bundle
  (only the `Toaster` region exports). Its preview is an honest styled explainer
  of the toast region; graded good as the best static representation.
- **Sheet**: portal overlay. Open cells render the panel over the real
  `bg-black/30` backdrop (honest); the `Closed` cell shows a clean trigger.
- **QrFrame** requires `children` (it's the frame, not a QR generator) — preview
  ships a dependency-free faux-QR `<svg>`.
- **Sidebar** must be wrapped in `SidebarProvider`; preview uses `collapsible="none"`
  in a height-bounded box with `--sidebar-width` set inline.
- **Tabs** needs `defaultValue`, **Sheet** needs `defaultOpen`, to show state statically.
- **Badge has NO `reward` variant** (only default/secondary/destructive/outline/ghost/link).
- **Hugeicons**: use `GiftIcon` (NOT `Gift01Icon`). Confirmed glyphs used:
  Coffee01Icon, Store01Icon, Stamp01Icon, QrCode01Icon, InboxIcon, GiftIcon.
  Brand `<Icon>` + `icon` props take the BARE glyph reference (`icon={Coffee01Icon}`), not JSX.
- **Separator** `vertical` needs a sized flex parent; **Skeleton** has no intrinsic
  size (set `h-*`/`w-*`/`size-*` via className).

## Preview import contract
- Authored previews import from the package name: `import { X } from "nabaperks"`
  (story-imports shim → window.WetInk; ALL exports incl. sub-parts available).
- Icons import directly: `import { Coffee01Icon } from "@hugeicons/core-free-icons"`.

## Re-sync risks
- **cssEntry is generated** — a re-sync that skips the Tailwind compile uploads
  unstyled CSS. Always regenerate `.ds-sync/wetink.css` first.
- **Synth-entry, no .d.ts** — prop contracts come from ts-morph reading source
  `.tsx`; weaker than a compiled `.d.ts`. `cfg.dtsPropsFor` is the escape hatch.
- **Grouping**: `ui/` primitives land in group "general" (the `ui` dir name is
  in the converter's GENERIC_DIR list); brand/loyalty/data/forms get real
  groups. Cosmetic for the DS pane; refine via doc `category` stubs if desired.
- Auth: this environment cannot run `/design-login`; the build is local-only and
  the upload is deferred until design access is authorized from a terminal.
