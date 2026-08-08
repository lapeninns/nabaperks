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

## 3. ~~Three heroes~~ RESOLVED; legal TOC spines superseded

The three heroes were measured and swept — see 01#12 in STATUS-marketing.md
(1,044/975/1,117px stacked at 768px, 708/643/721px two-column, no overflow at
768/900/1024). The legal TOC order is now covered by item 7's contract question
rather than a visual one.

Original text follows for history:

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

### Update: prerequisite 1 is now done

`NEXT_THEMES_OPTIONS` lives in `lib/theme/next-themes-options.ts` and is
imported by both the provider and the test, so the config and the pin cannot
drift apart. Verified by flipping `enableSystem` to false — the exact 05#61
change — which now FAILS the hash assertion instead of passing silently.

Remaining before 05#61 can be actioned:

1. ~~Make the test import the real provider config.~~ Done.
2. Re-pin all three hashes together — `NEXT_THEMES_SCRIPT_SHA256`,
   `..._SERVER_RENDER_...` and `..._APP_RENDER_...` cover different render
   paths, and only the server-render one is trivially reproducible.

This is security configuration, so it wants a deliberate change with a staging
readback, not a drive-by edit.

I attempted step 2 independently and stopped: serving a production build and
hashing its inline scripts reproduced `NEXT_THEMES_SCRIPT_SHA256` exactly, which
proves the method, but `SERVER_RENDER` and `APP_RENDER` come from render paths
needing live credentials. Two of three unverifiable is not a margin worth taking
on a security header. The table above already carries the measured
`enableSystem: false` server-render hash.

Worth noting for the record: the defect is real and High. `enableSystem` is on,
so an OS-dark user gets `.dark` applied against a palette with exactly three
`dark:` variants in the product, and DESIGN.md calls dark "a dormant capability…
no user-facing toggle exists and none is planned". The dark-preview hotkey is
already unreachable (nothing passes `enableHotkey`), so forcing light costs the
catalogue nothing.

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

## 9. 02#30 — clamping reward terms is a product call, with numbers

The stub half of 02#30 is done (measured floor 70px, shipped at 72px). The
terms half is deliberately left to you.

Measured at a 260px ticket face, `text-sm leading-6`:

| merchant terms | lines | ticket height |
| -------------: | ----: | ------------: |
|       55 chars |     2 |         121px |
|       90 chars |     3 |         145px |
|      120 chars |     4 |         169px |
|      160 chars |     5 |         193px |

`line-clamp-2` plus a "Full terms" disclosure would cap the ticket at 121px —
about 48px back on a 120-character reward, on the customer's tallest surface.

The reason it is not done: these are the merchant's reward terms, the thing the
member is actually entitled to. Collapsing them behind a tap by default is a
product and arguably a consumer-terms decision, not a layout one. The legal
sheet infrastructure (`components/customer/legal-sheet.tsx`) already exists if
you want it.

## 10. BLOCKING: this branch regresses Lighthouse LCP, and the obvious fix hits a contract

CI is red on `Lighthouse (home)`, `(pricing)` and `(loyalty-for-pubs)`. All
three pass on `main`. This is a real regression introduced by this branch and it
should block the merge.

Measured on /loyalty-for-pubs (CI, 3 runs): **LCP 4,854 / 5,130 / 5,265ms**
against a **4,000ms** budget. Reproduced locally at 6,343ms.

### Cause

The typography fix added two font faces (Medium 500 and ExtraBold 800) so that
`font-medium` and `font-extrabold` stopped being browser-synthesised. That put
**four preloaded ~113KB .ttf files** on the critical path. Lighthouse's
simulated mobile throttling charges all of it against LCP.

Confirmed by experiment — removing just those two faces:

| build                     | LCP (local, 1 run) |
| ------------------------- | -----------------: |
| this branch               |            6,343ms |
| minus the two added faces |            4,257ms |
| all four faces as woff2   |            4,721ms |

So the two faces cost **2,086ms**, and shipping the same four faces as woff2
recovers **1,622ms** of it while keeping the typography fix.

Note the diagnosis is not the obvious one: the fonts are not slow to arrive
(~50ms on localhost) and TBT is 0ms. It is simulated-throttling bandwidth
contention on the preload, which is why this only shows up in Lighthouse.

### PARTLY FIXED — re-read the contract, it pins less than I said

`poster-font-assets.test.mjs` hash-pins only the four ORIGINAL files. Medium and
ExtraBold — the two this branch added, and the entire cause — are not pinned, so
they now ship as woff2 (113KB -> 46KB each) while Regular and Bold stay .ttf for
PDF parity. Local LCP 6,343ms -> 5,011ms; main measures 4,213ms on the same
machine. The residual ~92KB of preload over main is the real price of not
synthesising two weights, and may still exceed the CI budget.

Two other levers measured and rejected: `preload: false` (LCP 4,666ms but FCP
2,708ms vs a 2,500ms budget) and subsetting (impossible — the originals are
hash-pinned). All four weights are genuinely used, so none can be dropped.

CI after the woff2 change: **4,534 / 5,117 / 5,526ms** (was 4,854 / 5,130 /
5,265). The assertion floor moved 320ms; the runner variance is larger than the
fix. So the engineering levers are now exhausted and what remains is a design
call. Everything measured:

| lever                                | LCP (local) | verdict                                         |
| ------------------------------------ | ----------: | ----------------------------------------------- |
| baseline (this branch)               |     6,343ms | —                                               |
| **woff2 for the two unpinned faces** | **5,011ms** | **shipped**                                     |
| `display: optional`                  |     5,010ms | no effect — proves it is bandwidth, not swap    |
| `preload: false`                     |     4,666ms | rejected: FCP 2,708ms vs a 2,500ms budget       |
| drop the two added faces             |     4,257ms | works, but reverts the typography fix           |
| subset the .ttf                      |         n/a | impossible — the four originals are hash-pinned |
| main, same machine                   |     4,213ms | the control                                     |

`display: optional` measuring identically to `swap` is the useful datum: the
cost is preload bandwidth on the simulated critical path, not the font swap, so
no loading-strategy tweak will recover it. Only fewer or smaller bytes will.

**The decision:** two font faces, ~92KB preloaded over main, buy real
`font-medium` and `font-extrabold` instead of browser-synthesised ones — which
is defect 05#* that this branch was asked to fix. Either that is worth roughly
500-1,000ms of simulated LCP or it is not. I do not think an agent should
quietly pick either way, so the branch ships the typography fix and a red
Lighthouse check, with the revert one commit away.

### Original note — why I first thought woff2 was impossible

`tests/contracts/poster-font-assets.test.mjs:57` — "the app and PDF renderer
consume the same four local font files" — pins `BricolageGrotesque-Regular.ttf`
in `app/layout.tsx`. The PDF renderer needs .ttf (pdf-lib cannot read woff2), so
serving woff2 to the browser breaks the assertion. The contract's intent is
sound: screen and printed poster must not drift onto different faces.

I converted the fonts, measured the win, saw the contract fail, and reverted.
Nothing is weakened; the branch ships .ttf and the red Lighthouse check.

### The three options

1. **Extend the contract** to require the app and PDF to use the same
   _typeface family and weights_, with woff2 for the browser and .ttf for the
   PDF, asserting the two lists stay in step. Keeps typography and performance.
   Needs the assertion rewritten by someone entitled to change its intent.
2. **Drop the two added faces.** Recovers 2,086ms; `font-medium` and
   `font-extrabold` go back to being synthesised, which is the defect 05-design
   -system raised.
3. **Raise the LCP budget.** Not recommended without a reason beyond "our fonts
   got bigger".

## 11. 02#20 — collapsing the card rails, with the blocker corrected

The lane recorded this as "contract-pinned plus a product call". The first half
is wrong and I have corrected it in STATUS: **no test anywhere in `tests/`
references any of the five rail components**, and the contracts that do read
`customer-card-experience.tsx` pin only the pass rail's prop shape, its
`/pass/{id}` href, and that it sits outside the tile's own link. An accordion
around the rails breaks none of that.

So the accordion is buildable. What stops me is the product call, and it is
sharper than "closed by default":

- **`ReferralBonusBankNotice`, `ReferralSharePanel`, `GoogleReviewButton`** are
  evergreen promotion. Collapsing them costs a member nothing.
- **`CardOfferPassChip` and `CardGiftChip` are time-sensitive and actionable.**
  A pass has an expiry. Hiding one behind a closed disclosure by default is a
  real risk of a member missing something they own.

The audit asks for three rows closed by default, which would collapse all five.
A split — actionable rails stay visible, promotional rails collapse — reads
better to me, but that is a product judgement about what the card screen is
_for_, and it is not mine to make quietly. Both options are one small change.

## 12. 04#26 — sticky table headers need a nested scroll region

Re-tested in chromium rather than taken on trust, and the recorded blocker
holds. Measured on the customers harness at 1280x700:

- `[data-slot="table-container"]` computes `overflow-x: auto`, and CSS makes
  `overflow-y` **auto** with it. It is therefore a scroll container on both
  axes — but it has no height constraint, so `containerScrollsY` is `false`.
  Sticky-top inside it has a scrollport that never scrolls.
- Its parent is `surface-card overflow-hidden`, hidden on both axes.
- Proof: with `position: sticky; top: 0` forced onto the `<thead>`, a 400px page
  scroll moved it 269px -> 177px. It travelled with the page.

I also tried the clever way out — `overflow-y: clip`, which should leave no Y
scrollport and let sticky resolve against the viewport. Chrome coerces it to
`hidden` next to `overflow-x: auto`, and the header still did not stick.

So the only real fix is to bound the container's height (`max-h-[70svh]` or
similar) and let the table scroll vertically inside itself. That works, and it
turns every admin table into a nested scroll region — a different interaction
model on both desktop and touch, and a visible change to page rhythm across
eleven routes.

That is a UX decision, not a bug fix, so it is here rather than in a commit.
Everything else in 04#26 (lookup, filter chips, count, range, venue filter,
paginator) is done.

## 13. ~~One manual look: the hero card loop~~ CLOSED — now covered by a test

The gap is gone. `tests/e2e/hero-motion.motion.spec.ts` runs under a new
`motion` Playwright project that overrides `contextOptions.reducedMotion`, and
covers all four behaviours below automatically. Verified by sabotage: reverting
`if (paused) return` makes it fail.

Run it with `pnpm exec playwright test --project=motion`.

Original note follows.

### Original: a verification gap I could not close from here

`playwright.config.ts` sets `reducedMotion: "reduce"` on every project, and
`useStampJourneyLoop` short-circuits under reduced motion. So the stamp loop
never animates in ANY automated run. I confirmed this on the unmodified baseline
as well as this branch: `earnedCount` stays at its rest value throughout.

That means the fix in 01#17 — pause now genuinely stops scheduling, and the loop
stops when the card scrolls off-screen — is correct by inspection and green on
every gate, but has never actually been watched. Worth thirty seconds with
motion enabled on `/` and `/loyalty-for-pubs`:

1. the stamps should cycle;
2. "Pause the demo" should freeze it on the finished frame;
3. "Play the demo" should start it cycling again;
4. scrolling the hero away and back should stop and restart it.

Worth noting for future work: any finding about motion has this blind spot. The
browser tiers cannot see animation at all.

## 14. 05#65 — `ConsoleSection` declined, with the numbers

Half of this finding is done: 03#1 unified the merchant and admin shells to
`px-4 py-5 sm:py-6 lg:px-8 lg:py-8`, which is the `py-8 -> py-6` reclaim the
finding asks for.

The other half — mint `<ConsoleSection>` and route every `/app/*` and `/admin/*`
page section through it — I am declining, and here is the evidence rather than
an opinion.

**Console page rhythm is already conventional.** Gap values across `app/app` and
`app/admin`:

| value   | count | what it is                            |
| ------- | ----: | ------------------------------------- |
| `gap-6` |    41 | page-level rhythm — already one value |
| `gap-2` |    27 | inline rows inside components         |
| `gap-4` |    17 | mostly nested panels                  |
| `gap-3` |    15 | intra-component                       |
| `gap-1` |    13 | label/value pairs                     |
| `gap-5` |     6 | mixed                                 |

**The `py-*` claim does not hold for console pages.** The finding cites "26
distinct `py-*` values"; in `app/app` and `app/admin` the entire spread is
`py-10` x4, `py-2.5` x2, `py-16` x2, `py-12` x1, `py-0` x1. The 26 came from
counting the whole tree, marketing included.

**Only one page-level grid deviates** (`app/app/offers/page.tsx:147`, `gap-5`).
Everything else in the non-`gap-6` list is intra-component spacing that a section
component would not own anyway.

So the component would rename `<div className="grid gap-6">` to
`<ConsoleSection>` across 33+ files, produce no user-visible change, and churn
the visual baselines — which is the API sprawl 05#7 criticises, arriving as a
fix. If you want the abstraction anyway, as a named place to change console
rhythm later, that is a reasonable call and it is one commit; I am not making it
on the strength of a premise that measurement does not support.

## 15. 01#54 — the hero half of the type scale

The page-title half is done: seven `titleClassName` clamp overrides deleted, so
legal, auth and every marketing page now share `type-page-title` (30px / 36px).
Measured: /pricing, /terms, /signup and /faq are identical at both widths, and
the legal H1 is no longer larger than the pricing H1.

What is left is the finding's `hero-title` proposal —
`text-[clamp(2.25rem,6vw,3.5rem)]` for the landing, how-it-works and pub-guide
heroes.

I have not done it because it would undo work from this same campaign. 01#15
added the missing middle step to those ramps (`text-4xl sm:text-5xl
lg:text-6xl`) precisely so the 36px-to-60px jump stopped being a two-step snap.
A single `clamp()` replaces that ramp with continuous scaling — a different
typographic decision, not a consolidation of the existing one — and it would
also move the pub guide's H1 up a step, since it currently runs one rung below
the other two on purpose.

Both are defensible. Picking between them is a design call, and it wants the
visual baselines regenerated either way.
