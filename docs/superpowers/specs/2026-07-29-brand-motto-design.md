# Brand motto — design

**Date:** 2026-07-29
**Status:** implemented

## Problem

Nabaperks had no motto. The brand line was five different sentences spread
across five surfaces, each written for a different job and none of them a
slogan:

| Surface | Text |
| --- | --- |
| `app/layout.tsx` — SERP/tab title | "Nabaperks — No-app loyalty cards for UK food-led pubs" |
| `app/opengraph-image.tsx` — social card | "Done-for-you loyalty cards for food-led pubs" |
| `lib/seo/structured-data.ts` — OG alt | "Nabaperks — no-app loyalty cards for food-led pubs." |
| `lib/marketing/facts.ts` — landing eyebrow | "Loyalty for food-led pubs" |
| `lib/marketing/facts.ts` — landing H1 | "Give your weekend crowd a reason to come back on a Tuesday" |

## Decision

Ship **"Pub loyalty, sorted"** as a brand slogan in its own slot, alongside
those lines rather than replacing any of them.

### Why not the original "Pub loyalty redefined"

The owner's first draft was "Pub loyalty redefined". The structure was kept and
the last word replaced, for three reasons:

1. "Redefined" is generic B2B SaaS filler — it says nothing specific about the
   product and appears on thousands of unrelated landing pages.
2. It spends the slot without naming the wedge. The product's actual
   differentiator is that the card opens in a browser from a counter QR — no
   app, no wallet pass.
3. It is an unfalsifiable claim about the brand, which is the exact shape
   `scripts/check-banned-claims.mjs` exists to keep off public pages. It passes
   the script, but it works against the discipline the rest of the site keeps.

"Sorted" is a posture, not an outcome. It carries the done-for-you positioning
already in `LANDING` and `GUARANTEE` without promising the venue a result, so it
stays inside the claims boundary.

### Why a slogan slot, not a replacement

Putting the motto in the `<title>` would drop "no-app", "UK" and "food-led
pubs" from the strongest keyword line on the site. Putting it in the hero would
overwrite a tested conversion headline and break the pinned marketing contract
regexes plus the visual baselines. Neither cost buys anything a slogan slot
does not.

## Implementation

1. **`lib/marketing/facts.ts`** — new `BRAND` export (`name`, `motto`) beside
   `OPERATOR`, with the voice rule recorded in its docblock. Every surface
   imports it; no page hardcodes the string.
2. **`components/layout/marketing-layout.tsx`** — `FooterIdentity` takes a
   `withMotto` prop and renders the motto under the wordmark row. The focused
   (auth funnel) footer passes nothing and keeps its exact previous markup, so
   the blessed auth visual baselines stay stable.
3. **`app/opengraph-image.tsx`** — motto renders as a vermillion uppercase
   eyebrow above the 66px headline; `alt` leads with it.
4. **`lib/seo/structured-data.ts`** — `OG_IMAGE.alt` composed from `BRAND`.
5. **`app/layout.tsx`** — root `openGraph` + `twitter` blocks added (there were
   none), carrying `Nabaperks — Pub loyalty, sorted`, `siteName` and
   `images: [OG_IMAGE]`. The `<title>` is unchanged.

### Metadata resolution (verified, not assumed)

Next.js resolves `og:title` from each page's own `title` when the page sets
one, so the root `openGraph.title` does **not** flatten per-page social titles:

- `/`, `/loyalty-for-*`, `/guides/*` → keep their own og:title.
- `/demo`, `/start` (no `title` of their own) → now share as
  "Nabaperks — Pub loyalty, sorted" instead of the long keyword title.

`og:site_name` is now set on routes that previously had none, and the root
`opengraph-image` still resolves everywhere.

## Verification

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `pnpm test:contracts` — 495/495 pass
- `node scripts/check-banned-claims.mjs` — pass ("redefined"/"sorted" not banned)
- Footer, OG card image and per-route metadata checked in the dev preview
- Auth-funnel footer confirmed byte-identical (no motto, same wrapper classes)

## Owed after merge

Marketing visual baselines will go red — the footer appears on every marketing
page. Darwin baselines are environmentally stale, so the `-linux` twins must be
blessed from CI's actual PNGs, never with a local `--update-snapshots`.
