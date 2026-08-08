# UI audit fixes — items needing human sign-off

All Tier-1 (zero content loss) work in Waves 1–3, plus the no-copy Wave-2
height reductions, has shipped on `feat/ui-redesign-audit-fixes`. Items 1 and 2
below were initially deferred and have since been resolved; the rest remain
open because they need a human decision or a browser, not more effort.

## 1. ~~Real 500 / 800 font weights~~ — RESOLVED

Shipped in `feat(type): load the real 500 and 800 Bricolage faces`. Provenance
was established by re-downloading Regular and Bold from the pinned commit
(`ateliertriay/bricolage@84745e5b`, `fonts/ttf/`) and reproducing the two
SHA-256 values already recorded in `assets/fonts/README.md`, then taking
Medium and ExtraBold from that same tree. Both new faces carry the correct
OS/2 `usWeightClass` (500, 800). Poster PDFs are unaffected — `lib/qr/*` pins
the Regular/Bold filenames as exact string literal types, so the change is
additive and browser-only.

## 2. ~~A named type scale~~ — PARTLY RESOLVED

`.type-page-title` now implements DESIGN.md's page-title token and is adopted
by `PageTitle` plus the four `<h1>`s that had drifted off the responsive step.
Note one visual correction: page titles now use the documented 1.05 leading
rather than `leading-tight` (1.25).

Still open, and genuinely design decisions rather than codemods:

- **body / small.** DESIGN.md specifies 15px/13.5px at weight 500. Production
  sets body with `text-sm` (14px) at 435 call sites. Redefining it restyles
  every paragraph in the product.
- **The marketing display rank.** `landing/hero` and `landing/process-hero`
  use `text-4xl sm:text-6xl`; `pubs/pub-guide-hero` uses `text-3xl sm:text-5xl`.
  Unifying them means choosing one ramp.
- **`<h2>`.** Still 10 size combinations. DESIGN.md defines no section-title
  token, so there is nothing to implement against — the rank needs specifying
  before it can be enforced.

## 3. Three heroes and the legal TOC spines (finding 01#12) — blocked on visual check

The `md:` breakpoint sweep shipped for eight content grids. Left at `lg:`:
`landing/hero`, `landing/process-hero`, `pubs/pub-guide-hero`, and the
`/terms` + `/privacy` TOC spines. These pair prose with a rendered card, QR or
240px sidebar, where a ~360px column at 768px is a judgement call. They need
`pnpm test:visual` or a browser, which was not available here.

## 4. Everything in Tier 3 / Tier 4

Unchanged, as scoped: no legal/terms/privacy migration, no `confirmPassword`
removal, no marketing copy cuts, no `Button` size API deletions. See
`docs/ui-audit/README.md` for the full triage.

## 5. One audit recommendation that contradicts a contract test

Audit pattern P1 asks for the dead stock classes in `components/ui/*` to be
pruned so the files read as what they render.
`tests/contracts/ux-production-polish.test.mjs` locks the opposite policy —
"theme, not strip" — for `FieldLabel`, because those slots have live consumers
and the unlayered layer already supplies their treatment. The test is
authoritative; the audit finding should be closed as won't-fix or the contract
renegotiated deliberately.

## 6. The CSP theme-hash test cannot detect provider drift (found during 05#61)

`lib/security/csp.ts` pins three SHA-256 hashes for the next-themes bootstrap
script. `tests/unit/csp-theme-hash.test.mjs` verifies the pin — but it builds
its **own** config literal:

```js
{ attribute: "class", defaultTheme: "light", enableSystem: true, ... }
```

rather than reading `components/theme-provider.tsx`. So if the real provider's
props change, the injected script changes, the pinned hash goes stale, CSP
blocks the theme script in production — **and the suite stays green**.

Measured while attempting 05#61:

| provider config                                | script SHA-256                                        |
| ---------------------------------------------- | ----------------------------------------------------- |
| `enableSystem: true` (current, pinned)         | `sha256-J1wQB5qnh90IAwdc5uHGmBFTTupFNURrdioqoKFQF0w=` |
| `enableSystem: false` (audit's recommendation) | `sha256-UB8ZQDPPx/Vb2cqBe4pW3j8hm5RWjlg5zlcRw0uxtiE=` |

Two things are needed before 05#61 can be actioned:

1. Make the test import the real `ThemeProvider` (or export its options object)
   so config and pin cannot drift apart.
2. Re-pin all three hashes together — `NEXT_THEMES_SCRIPT_SHA256`,
   `..._SERVER_RENDER_...` and `..._APP_RENDER_...` cover different render
   paths, and only the server-render one is trivially reproducible.

This is security configuration, so it wants a deliberate change with a
staging readback, not a drive-by edit.

## 7. 01#49 — a measured CLS 0.19 on the SEO hub, held open by one assertion

The marketing lane wrote the fix, hit the contract, and reverted. I have now
measured what that costs, so the renegotiation can be decided on numbers.

`components/marketing/pubs/guide-spine.tsx` renders the mobile section list as
`hydrated && !open ? "hidden lg:block" : "grid"`. The server sends the full
8-link list visible; hydration collapses it.

Measured on /loyalty-for-pubs at 390x844 (chromium):

|                                    | value                |
| ---------------------------------- | -------------------- |
| section list height at first paint | **302px**            |
| after hydration                    | **0px**              |
| document height                    | 11,747px -> 11,472px |
| **Cumulative Layout Shift**        | **0.1924**           |

Google's "good" threshold is 0.1. This is the site's longest page and its SEO
hub (an `Article` with `dateModified`), so the shift is both a Core Web Vital
regression and a visible flash of content that then vanishes.

### Why it is still open

`tests/contracts/marketing-offer-source` pins the literal expression:

```js
assert.match(
  spine,
  /hydrated && !open \? "hidden lg:block" : "grid"/,
  "the mobile section links must remain visible before client enhancement"
)
```

The stated intent — links reachable without JS — is sound. But the expression
that satisfies it is exactly the expression that causes the shift: it shows the
list, then hides it. Any fix that removes the shift changes that expression, so
the assertion and the finding are genuinely incompatible. This is not a
formatting technicality and I have not touched it.

### Two options, both needing a decision

1. **Native `<details>`/`<summary>`** (the audit's recommendation). No JS, no
   hydration branch, no shift. Links become _operable_ without JS rather than
   _visible_ — which may or may not satisfy the assertion's author.
2. **Stop collapsing on hydration.** Keep the list server-rendered and visible
   on mobile; make the toggle an enhancement that never hides content by
   default. Strictly better against the assertion's stated intent (visible
   before AND after), and removes the shift — but the pinned literal no longer
   matches.

Either way the assertion needs rewriting to express the intent rather than the
implementation. Recommend option 2 and an assertion on the rendered guarantee.

## 8. The copy/product decisions, measured

These five were flagged as "needs a product decision" and left at that. Here is
what each actually costs, so the decision is not made on prose.

### 02#64 — offer landing (Critical)

Measured at 390x844 on the offers harness, customer surface:

|                                 | value         |
| ------------------------------- | ------------- |
| "Claim this offer" CTA position | **y = 904px** |
| viewport                        | 844px         |
| page height                     | 7,102px       |

The primary conversion action sits **below the fold** — a member must scroll
before they can claim. The audit estimated y760; the measured figure is worse.
The decision is whether the four restatements of the benefit above it earn
those 904px.

### 01#55 — the three persona spokes

| route                  |   height | words |
| ---------------------- | -------: | ----: |
| /loyalty-for-pubs      | 11,472px | 1,741 |
| /loyalty-for-bars      |  2,363px |   359 |
| /loyalty-for-cafes     |  2,373px |   361 |
| /loyalty-for-takeaways |  2,373px |   361 |

The three spokes render from one `PersonaSpokePage`; their page sources are
**98.1% identical**. They are the same ~360-word page three times with the noun
swapped. The decision is binary: either write genuinely vertical-specific copy
(~1,080 words), or collapse them to one route and redirect. Shipping three
near-identical noindexed pages is the only option with no upside.

### 02#50 — join wizard terms step (Critical)

NOT measurable here: the join flow needs live Supabase credentials
(`customer-join-*-live-db.spec.ts` all skip without them), so I could not put a
number on the CTA position. The audit's own arithmetic puts it at ~y780 on a
667px viewport. Worth measuring against a live DB before deciding.

### 01#23 and 04#54

Both are copy edits whose cost is the copy itself, not layout: 01#23 cuts eight
objections to five, 04#54 shortens five admin panel descriptions. Neither has a
measurable geometry argument — they turn on whether the words are load-bearing,
which only the product owner can say.
