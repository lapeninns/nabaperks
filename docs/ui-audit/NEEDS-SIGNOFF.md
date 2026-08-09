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

## 5. One audit recommendation that contradicts a contract test — DISPOSITION

**Recommendation: close audit pattern P1 as won't-fix, except the part already
done.** Reasoning below; overrule it by renegotiating the contract deliberately.

Audit pattern P1 asks for the dead stock classes in `components/ui/*` to be
pruned so the files read as what they render.
`tests/contracts/ux-production-polish.test.mjs` locks the opposite policy —
"theme, not strip" — for `FieldLabel`, because those slots have live consumers
and the unlayered layer already supplies their treatment. The test is
authoritative; the audit finding should be closed as won't-fix or the contract
renegotiated deliberately.

### What P1 actually contained

P1 lists fourteen dead declarations in `components/ui/*`. Two of them it flags as
**not** overridden and shipping visibly wrong: `Card`'s stray `ring-1` hairline
outside the 2px ink border, and its 24px image corners bulging past a 10px card.
Those are a real defect, not a readability complaint, and they are **already
fixed** — 05#18 is closed, `card.tsx` carries no `ring-1`, and nested images now
take `rounded-t-lg`/`rounded-b-lg`.

The other twelve are genuinely overridden. Verified rather than assumed: with
`rounded-2xl` still in the source of six primitives, the computed radii are 10px
on input/textarea/alert, 999px on badge and 4px on progress. The layer wins.

So what remains of P1 is "prune declarations that have no visual effect so the
file reads honestly" — worth something, but it is precisely what
`ux-production-polish` forbids for the slots it covers, on the grounds that a
pre-themed latent state must not be strippable. Trading a contract's safety
property for source tidiness is a bad trade at this scale, and the two
declarations that mattered are already gone.

## 6. ~~The CSP theme-hash test cannot detect provider drift~~ — RESOLVED (05#61)

`lib/security/csp.ts` pins three SHA-256 hashes for the next-themes bootstrap
script. This section recorded two prerequisites before 05#61 could be actioned.
Both are now done, and both of the things that made step 2 look impossible were
wrong.

### The three hashes are three BUNDLERS, not three unreachable render paths

The body next-themes inlines is `(${themeScriptFn.toString()})(${args})`, and
`toString()` returns whatever the active bundler emitted. So the hash differs
per bundler as well as per option:

| constant                                  | render path                                 |
| ----------------------------------------- | ------------------------------------------- |
| `NEXT_THEMES_SCRIPT_SHA256`               | `pnpm build` — webpack, minified            |
| `NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256` | `react-dom/server` against `dist/index.mjs` |
| `NEXT_THEMES_APP_RENDER_SCRIPT_SHA256`    | `pnpm dev` — SWC, pretty-printed            |

The earlier note said `SERVER_RENDER` and `APP_RENDER` "come from render paths
needing live credentials". They do not need credentials or authentication at
all: `APP_RENDER` is what `next dev` serves on **any** page, including `/login`.
Both dev modes agree — `next dev` (Turbopack) and `next dev --webpack`, which is
what `playwright.config.ts` boots, emit byte-identical bodies.

Confirming that took one wrong turn worth recording. Enumerating every next-themes
bootstrap function text in the whole build output (server chunks, client chunks,
`dist/index.mjs`, `dist/index.js`) and hashing each with the real options produced
five candidates, two of which matched pins — so `APP_RENDER` looked like a **stale
pin for a build artefact that no longer exists**, and the tempting conclusion was
that it could be dropped. It could not: it is the dev-server hash, and dropping it
would have broken the theme bootstrap in every local run and every Playwright run.
An exhaustive search over the artefacts you thought of is not an exhaustive search.

### Both prerequisites are done

1. ~~Make the test import the real provider config.~~ Done earlier —
   `NEXT_THEMES_OPTIONS` lives in `lib/theme/next-themes-options.ts`.
2. ~~Re-pin all three hashes together.~~ Done, each by reading its own path back:
   the webpack hash from `.next/server/app/index.html`, the dev hash from a page
   served by `next dev`, the server-render hash from the unit test. Then verified
   end-to-end in both servers: the script each one actually serves hashes to its
   pin **and** appears in that same response's `script-src-elem`.

`tests/unit/csp-theme-hash.test.mjs` now stores the two bundler bodies and asserts
each one's argument tail equals the tail the real library produces from the live
`NEXT_THEMES_OPTIONS`. Change an option and all three fail together, which is the
behaviour this section asked for. Sabotage-checked four ways: flipping
`enableSystem`, changing `storageKey`, corrupting one byte of a stored body, and
duplicating two pins each fail it; all four restore clean.

### A correction: this section overstated the defect

The previous text said "the defect is real and High. `enableSystem` is on, so an
OS-dark user gets `.dark` applied". **That is false**, measured in Chromium at
`colorScheme: dark` against a production build with `enableSystem: true`:
`documentElement.className` is `light` and the body ground stays
`rgb(246, 241, 230)`. The bootstrap only consults `prefers-color-scheme` when the
stored or default theme is the literal string `"system"`, and `defaultTheme` is
`"light"`; nothing in the product ever calls `setTheme("system")`.

So 05#61 shipped as **defence-in-depth, not a live-bug fix** — it removes one of
the two conditions rather than a reachable dark render. The finding's own wording
was the accurate one ("one config flag away"); this section's paraphrase of it was
not. The `/dev/design-system` toggle still reaches `.dark` explicitly, verified
after the change.

### Rejected: pass a nonce instead of pinning hashes

next-themes accepts a `nonce` prop, which would let CSP drop all three hashes.
Rejected: the nonce lives in a request header, so `app/layout.tsx` would have to
call `headers()`, which makes the root layout dynamic and de-optimises every
prerendered marketing page — a much larger regression than the problem, and it
collides with the LCP work in section 10.

## 7. CORRECTED — 01#49's CLS 0.19 was a dev-server artefact; production is 0.00

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

### CORRECTED — the 0.19 is a dev-server artefact; production CLS is 0.00

I re-measured before proposing the renegotiation, and the premise does not
survive.

The 0.1924 (and my re-run's 0.2070) came from Playwright against `pnpm dev`.
Running the **identical probe** against a production build (`pnpm start`):

| build          | CLS on /loyalty-for-pubs |
| -------------- | ------------------------ |
| dev server     | 0.2070                   |
| **production** | **0.0000**               |

Lighthouse agrees, on the production build, mobile emulation, 3 runs each:
**0.0517 / 0.0517 / 0.0000** before the font subsetting and **0.0000 / 0.0000 /
0.0000** after. Google's "good" threshold is 0.100.

Why the difference: in dev, CSS and fonts are injected asynchronously and the
hydration pass is far slower, so the collapse lands after paint. In the built
artefact it does not.

Two supporting facts from the same investigation:

- The collapsing section list sits at **top 1295px** on a 390x844 viewport. It
  is below the fold, so even when it does collapse it moves no visible content —
  which is why forcing it open (`useState(true)`) changed CLS by **zero**, to
  sixteen decimal places. I tried exactly that, saw the identical number, and
  reverted it as an unforced UX change.
- The real shift the dev observer attributes the 0.207 to is text moving 32px at
  the top of the page, not the spine at all.

**So there is nothing to renegotiate.** The contract assertion stands unmodified,
01#49's stated defect does not exist in the shipped artefact, and section 18's
dependency dissolves with it.

Standing lesson: **Core Web Vitals measured against a dev server are not
evidence.** This one nearly bought a contract renegotiation.

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

## 10. RESOLVED — subsetting the two unpinned faces fixed the LCP regression

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

### RESOLVED — the "impossible" lever was possible for the half that mattered

I closed this section saying the engineering levers were exhausted. They were
not. The line "subsetting (impossible — the originals are hash-pinned)" is true
of the originals and false of the two faces that actually cause the regression —
which the same section had already established are unpinned. My own blocker tell
number two, in my own document: _true of one half, applied to the whole._

Bricolage carries 527 glyphs for an en-GB site. Subsetting to Latin, Latin-1,
Latin Extended-A/B, combining marks and the punctuation/currency/arrow ranges
drops 124 of them, mostly Vietnamese, taking each face 47KB -> 39KB.

Measured on /loyalty-for-pubs, 3 runs per arm, same machine and build:

| build  |               LCP |     FCP |
| ------ | ----------------: | ------: |
| before | 5,022/5,009/5,025 | 1,658ms |
| subset | 3,625/3,771/3,627 | 1,205ms |

`/` and `/pricing` land at 3,769ms and 3,773ms against a 4,000ms budget. All
three previously failing routes pass locally, and the branch is now faster than
`main` measured on the same machine (4,213ms).

Kept against smaller files: combining marks and `mark`/`mkmk` (+4.4KB, because
venue names are user-generated and may be decomposed), `tnum` (for
`.numeric-tabular`), `kern`, and hinting (another 11KB per face was available,
declined — not worth risking small-text rendering on a typography branch).

`scripts/build-subset-fonts.sh` regenerates both faces from the .ttf sources.

**No design decision is needed. This section no longer blocks the merge.** CI
should be re-run to confirm the local result holds on the runner, whose variance
was previously larger than the fix.

## 11. 02#20 — collapsing the card rails, corrected twice

**Superseded in two places. Read this, not the version below.**

The first correction (kept for the record) was that no test pins the rails. The
grep that produced it searched for the five **component names**, and a browser
test never sees a component name. It sees a `data-testid`:

    tests/e2e/customer-referral-bonus-stamp.spec.ts:102
      const share = page.getByTestId("referral-share-panel")
      await expect(share).toBeVisible()

Measured in Chromium on `/dev/home-harness/referral-bank` at 390px: wrapping
`ReferralSharePanel` in a closed `<details>` — exactly what "collapsed by
default" renders — takes the card page from **1646px to 1365px (−281px, 17%)**
and makes `isVisible()` return **false**. So the audit's headline saving is real
and the mechanism fails a live assertion. That assertion is not weakenable: it
is the proof that the card surfaces a referral link carrying the opaque
`referral_code` and never the membership UUID.

The second correction is to the split this section proposed. It sorted
`ReferralBonusBankNotice` into "evergreen promotion". It is not:

    hasVisibleReferralBonusBank(bank) => bank.banked > 0 || bank.awardedToday > 0

It renders only when the member **owns** banked bonus stamps, and its copy
reports them against `REFERRAL_BONUS_DAILY_CAP` — how many can land today and
how many stay banked. That is conditional, owned and time-bounded: the same
argument that keeps `CardOfferPassChip` visible keeps this visible.

What is left, after both corrections:

| rail                      | unconditional? | under test?               | height |
| ------------------------- | -------------- | ------------------------- | ------ |
| `CardGiftChip`            | no             | no                        | ~110px |
| `CardOfferPassChip`       | no             | contract-pinned props     | ~130px |
| `ReferralBonusBankNotice` | no             | `referral-bonus-stamp`    | 324px  |
| `ReferralSharePanel`      | **yes**        | **e2e visibility, above** | 305px  |
| `GoogleReviewButton`      | **yes**        | no                        | 44px   |

The duplicated primary the finding also asks about is **already fixed**: one
`size="lg"` "Share your link" with copy demoted to `variant="link" size="sm"`.

So the only rail that is both unconditional promotion and free to collapse is
the Google review button, at **44px of 1646px (2.7%)** — a disclosure costs more
than it saves. Collapsing the share panel needs a decision about the referral
loop AND a rewrite of the e2e proof; collapsing the bank or the pass hides value
the member already owns. None of those is a quiet change.

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

### Update: rows-per-page raises the stake, with a measurement

The catalogue's console table (the same `DataTable` every admin list uses)
measures a **40px `thead`** and **69px rows** at 1440x900 with two-line cells.
So a full page of admin table is now:

| rows per page | table height | viewport heights at 900px |
| ------------: | -----------: | ------------------------: |
|            25 |     ~1,765px |                      ~2.0 |
|            50 |     ~3,490px |                      ~3.9 |
|           100 |     ~6,940px |                      ~7.7 |

At 25 rows the operator loses the column headers about two thirds of the way
down one list. At 100 — now selectable, 04#56 — the headers are off-screen for
roughly seven screens of scrolling, on tables whose columns are pills, dates
and masked identifiers that are genuinely hard to tell apart without a header.

That does not change the mechanism (the container still has no bounded height,
still computes `overflow: auto/auto`, and `overflow-y: clip` is still coerced
to `hidden`; do not re-measure that). It changes the value of fixing it, and it
adds a cheaper option to the two already recorded:

- bound the table region (`max-h-[70svh]`) on every admin table — the full
  nested-scroll change, all eleven routes, needs sign-off;
- bound it **only when the page size exceeds the default**, i.e. the operator
  who asked for 100 rows opts into a scroll region and nobody else's page
  rhythm changes. Same CSS, scoped by a param that now exists.

The second is a much smaller decision than the first, and it is the one I would
put in front of a human. It is still a UX change, so it is still here.

### Third re-measurement, and the one detail that changed (this pass)

Re-probed both ancestors in isolation rather than trusting the earlier note,
because I had just caught myself recording a convenient negative from too narrow
a window. The blocker survives:

| wrapper                            | computed              | thead after scroll | stuck |
| ---------------------------------- | --------------------- | ------------------ | ----- |
| `overflow-x:auto; overflow-y:auto` | `auto` / `auto`       | -500px             | no    |
| `overflow-x:auto; overflow-y:clip` | **`hidden`** / `auto` | -500px             | no    |

So `overflow-y: clip` really is coerced to `hidden` beside `overflow-x: auto` in
this Chrome, and the escape hatch stays shut.

What IS new: there are **two** blocking ancestors, not one, and the outer one is
dead weight on admin. `DataTable`'s card is `surface-card overflow-hidden`,
where the `overflow-hidden` exists to clip content to the rounded corners — but
every admin table passes `className="rounded-none border-0 shadow-none"`. There
are no corners to clip. That wrapper could be dropped on admin for free.

It would not help on its own: the table above with `overflow-x:auto` alone still
did not stick. Removing one of two blockers changes nothing, which is exactly
why it is worth writing down — it is the obvious cheap fix and it does not work.

The options remain the three already listed, and option 3 (bound the height only
when `size > 25`) is still the cheapest.

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

### Re-measured independently, and two wordings corrected

The gap table and the console `py-*` spread above both reproduce exactly. Two
things in the prose do not, and neither changes the decision:

- **"41 of 47 page-level grids" is loose.** 47 is 41 `gap-6` + 6 `gap-5`, and it
  reads as though six page-level grids deviate. Only one does — the other five
  `gap-5` sites are an inverted QR panel, two responsive step-ups from `gap-3`
  inside `launch`, and two `ReceiptCard`s. The honest figure is **41 of 42**,
  which is a stronger argument for declining, not a weaker one.
- **"26 distinct `py-*`" is now 18 tree-wide.** Measured across `app` and
  `components` with a class-boundary-anchored pattern. A naive `py-` grep returns
  23 and five of those are false positives from `copy-to-clipboard`,
  `copy-url-button`, `copy-field`, `copy-drift` and a stray `py-10)`.

Two additions to the evidence:

- `gap-8` and `space-y-*` appear **zero** times in `app/app` and `app/admin`, so
  the finding's "every page then adds its own `grid gap-6` / `gap-8` /
  `space-y-4`" describes drift that is not there.
- The finding names **three** shells and 03#1 unified two. `customer-app-shell`
  is still `px-4 pt-6 sm:px-6` plus the tab-bar clearance, which is correct for a
  410px capped column with a fixed bottom bar and is not console rhythm. Worth
  stating so the shell half is not read as covering all three.

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

## 16. Hard caps in the admin console (04#6) — two closed, two left

Billing and referrals no longer truncate: both take a venue lookup and a
paginator (25/50/100 rows). What is left is two surfaces where a notice is
still the whole answer:

| surface                  | cap | notice                                           |
| ------------------------ | --: | ------------------------------------------------ |
| fraud flags              | 100 | "Showing the newest N of M flags in this queue." |
| redemption failures      | 100 | "Showing the newest N of M recorded failures."   |
| evidence case ledger     | 100 | "Showing the newest N of M evidence cases."      |
| evidence merchant picker | 200 | "First N of M venues, alphabetically."           |

The merchant picker is still the one to look at: it is an alphabetical
`<select>`, so past 200 venues a late-alphabet name cannot be selected at all.
The notice stops an operator concluding the venue is not on the platform; it
does not let them file evidence against it. Making it searchable also needs a
decision on whether the evidence form may reference a venue an operator cannot
see in a list, which is why it is here and not in a commit.

### One thing on referrals that is a judgement call, not a bug

`admin_referral_ops` is a guarded RPC whose signature is fixed at
`(uuid, text, integer, integer)`: it filters by ONE venue id, not a name
fragment. The lookup therefore resolves the fragment against `merchants`
first, and when it matches more than one venue the panel renders a chooser
instead of picking one. Three dispositions were considered:

1. apply the fragment to whichever venue sorted first — silently answers a
   different question, rejected;
2. run unfiltered when the fragment is not unique — the same defect, at larger
   scale, rejected (and `decideVenueFilter` has a unit test that fails if the
   no-match branch ever returns "unfiltered");
3. ask which venue — shipped.

The alternative to all three is extending the RPC with a `p_venue text`
argument. That is a schema change, not a UI one: `create or replace` with a
different argument list adds an overload rather than replacing, so every
defaulted call site becomes ambiguous, and doing it properly needs
`drop function` + recreate proved against a live database (`pnpm test:db`),
which this branch cannot run. If a venue-name fragment on referrals is wanted
without the chooser, that is the work.

### Cmd-K and the sticky filter bar

Still open, and still the least valuable third of the finding: both are
navigation over query params that now exist on six of eleven routes.

## 17. The last 1.5px is `.w-tag` itself (03#25)

I closed 03#25 twice — once before the merge, once after re-sweeping the six
`border-[1.5px]` call sites main reintroduced. Both times I was reporting the
Tailwind call sites and not the utility they were imitating.

`app/globals.css`'s `.w-tag` is:

```css
border: 1.5px solid var(--w-line);
border-radius: 999px;
```

and `components/brand/mono-tag.tsx` applies `.w-tag` to every `MonoTag`, which
renders in **52 files**. So the finding's premise — "DESIGN.md states borders are
2px solid ink everywhere… there is no 1.5px in the system" — is still true of
DESIGN.md and still false of the tree, in the one place that matters most.

The call sites are worth having fixed regardless: they were hand-rolled pills
diverging from the shared one. But raising `.w-tag` to 2px changes every mono
pill in the product, and the baselines are already stale, so it is a decision
rather than a sweep.

Three ways to resolve it, in the order I would consider them:

1. **Raise `.w-tag` to 2px.** Consistent with DESIGN.md as written, and the pill
   gains 1px per side (padding is `4px 11px`, so nothing reflows).
2. **Document 1.5px as a sanctioned exception** in DESIGN.md, on the grounds
   that a 2px stroke on an 11px pill reads heavier than the same stroke on a
   card. That is a legitimate typographic argument and DESIGN.md currently does
   not make it.
3. Leave both as they are, which is the only option that keeps the design
   system's stated rule and its shipped utility disagreeing.

03#25 is back to `[~]` until one of those is chosen. I would rather correct a
closure than carry a green mark that a reader would find wrong in one grep.

## 18. UNBLOCKED — 01#60 no longer waits on 01#49

These read as separate blocked findings and are the same one.

01#60 asks for a single TOC pattern across the three long-document families, and
prefers reusing `GuideSpine`. Its "at minimum" alternative is done and verified:
every guide `h2` has a slug id, all five TOC links resolve, the anchor offset is
the shared 128px, and the "On this page" disclosure is collapsed by default.

The lane recorded the rest as "a larger refactor of a contract-pinned client
component". That reason is wrong in a way worth correcting:
`marketing-offer-source` pins exactly **one line** in `guide-spine.tsx` —

```js
;/hydrated && !open \? "hidden lg:block" : "grid"/
```

— not the component's shape. A generic spine could keep it.

The real reason is that this line is 01#49: the section list is 302px at first
paint and 0px after hydration, which measures **CLS 0.1924** against Google's
0.1 "good" threshold (section 7). Reusing the spine as it stands would take a
measured layout-shift defect that currently affects one page and put it on every
guide.

So the order is fixed: resolve 01#49 — which means renegotiating that assertion,
since the fix was written and reverted — and 01#60's preferred form becomes
available. Until then the guides keep the disclosure, which has no shift at all.

Doing 01#60 "properly" first would make the site more consistent and measurably
worse.

### UNBLOCKED — 01#49 dissolved, so the ordering constraint is gone

Section 7 now shows the CLS defect does not exist in a production build
(0.0000, three Lighthouse runs plus a direct probe). The reason for not reusing
`GuideSpine` was "it would spread a measured layout-shift defect to every
guide". There is no such defect to spread.

What remains of 01#60 is therefore an ordinary refactor with no blocker: extract
a generic TOC from `GuideSpine`, keeping the one pinned line, and use it for the
guides and legal families. It is real work and it touches a contract-pinned
component, so it wants its own careful pass rather than being tacked onto this
one — but it is no longer waiting on a decision from anyone.

## 19. 02#10 — the wallet tile, measured and de-risked

The audit wants `HomeCardTile` to become a fixed ~120px summary row. Measured on
the home harness at 390px: the tile's link is **294px** and the block including
the pass rail is **338px**. (The audit said ~330px for the tile itself; it was
close, and it is 294px now that the chrome above it was cut.)

Both contract claims in the status note are real, and they constrain the shape
differently from how the note reads:

- `offer-customer-pass-wiring` requires the `/pass` link to sit **outside** the
  tile's own `Link`. That is a sibling rail, so it does **not** block a summary
  row — it just cannot be folded inside one.
- `referral-bonus-stamp:168` requires `ReferralBonusBankMini` to render **inside**
  `home-card-tile.tsx`. That one is inside the tile, and a 120px row has to keep
  it.

So the row is buildable and the blocker is not a wall. What it is, is a redesign
of the customer's first screen: deciding what a wallet tile shows at a glance
(venue, progress, one action) and what moves behind a tap, while keeping a
compact bank panel and a pass rail visible. That is a product decision about the
home surface, not a resize, which is why I have not taken it.

If you want it, the cheap first step is deciding whether the stamp grid belongs
on the tile at all — it is the single tallest block in there, and `/card/[id]`
already renders the full one.

## 20. 04#48 — the Radix swap, declined with the proof

The note said the shadcn `Checkbox` swap "needs browser proof". It has it now.

`AdminConfirmCheck` gates QR regeneration and reward cancellation. Measured on
the catalogue:

| property   | audit asked for | measured                                                                 |
| ---------- | --------------- | ------------------------------------------------------------------------ |
| box        | 20px            | **22px**                                                                 |
| tap row    | 44px            | **48px**                                                                 |
| `required` | —               | `true`                                                                   |
| unchecked  | —               | `checkValidity()` false, "Please check this box if you want to proceed." |
| checked    | —               | valid                                                                    |

Every target in the finding is met or exceeded, and the gate enforces itself
through native constraint validation — **no JavaScript at all**. On a control
whose entire job is to stop an irreversible action, that is not an incidental
property.

The shadcn `Checkbox` is Radix: a `<button role="checkbox">` plus a hidden
input. Its `required` handling depends on the client bundle having loaded and
hydrated. Swapping would move the enforcement of an irreversibility gate from
the browser's own form validation into application JavaScript, in exchange for
using the same primitive as elsewhere.

I do not think that trade is worth making, so 04#48 is closed as done-with-a-
different-mechanism rather than left open. If you want primitive consistency
across the console anyway, that is a reasonable call — but it should be made
knowing what it costs here, which is why this is written down rather than
silently skipped.

## 21. 03#52 — what cursor paging on the activity feed would cost

The dead "Load more" is fixed (at `limit=250` the href asked for 300 against a
250 clamp, so the press re-rendered the same rows). The audit also wants
`?before=<cursor>` or date-window paging with a ~50-row window. That part is
open, and "it changes the read model" undersells it. Two specific things break:

**1. Search would silently narrow to one page.** `getEnrichedMerchantActivity`
deliberately does NOT push `q` into the query — the only first-class text column
is `event_name`, and narrowing on it would hide rows whose match lives in the
customer label, reward name or metadata, and those joins carry PII that must not
reach a search predicate. So `q` is a client-side refinement over the loaded
window. Today that window is everything up to the ceiling; under cursor paging
it becomes the current page, and "search your activity" would quietly mean
"search these fifty rows".

**2. Stamp pairs straddle every boundary.** The loader over-fetches by one row
so a request/collect pair split across the window edge can borrow the spare and
thread into a single card instead of rendering as two orphans.
`threadActivityRows` takes the full `limit + 1` window and emits `limit` rows.
Every additional cursor boundary is another place a pair can split, and the
one-row spare only covers one such case per page.

Neither is unsolvable — server-side search over a materialised label column
would fix (1), and threading could look back a row across the cursor for (2).
Both are data-layer work with a privacy review attached, which is a different
kind of change from the rest of this campaign.

## 22. The three contract-blocked findings, read closely

03#46 turned out to be blocked by a misreading — the contract forbade a `??`
error merge, not the blur validation the note blamed. So I read the other three
the same way. All three blocks are real. They are not the same KIND of block,
and that matters if you renegotiate any of them.

**01#63 — mechanism conflict, most renegotiable.** `legal-p3-polish` asserts
`<aside className="… order-last … lg:order-none">`, and its header gives the
reason: on mobile the TOC must sit below the content _so the title is above the
fold_. The audit wants the TOC above the article — but as a **collapsed
`<details>`, ~56px**. That serves the very goal the assertion protects. The
conflict is in the mechanism, not the intent, which makes this the one worth
reopening first.

**01#65 — genuine design disagreement.** `legal-heading-structure` asserts
`<h2 className="mono-meta` and explains that clause titles must be real headings
carrying the sanctioned mono utility. The audit wants them to stop being mono
micro-type entirely (`text-base sm:text-lg font-extrabold`, because an 11.5px
heading over 14px body is inverted hierarchy). Both positions are coherent. The
contract encodes one; the audit argues the other. Someone has to choose.

**01#49 — the measured one.** Covered in section 7: the pinned expression causes
CLS 0.1924 against a 0.1 threshold. This is the only one of the three where the
contract's own goal (no pre-hydration flash) and the measured outcome (a large
layout shift) are in tension with each other, rather than with the audit.

Ranked by what I would revisit: 01#49 (a measured defect), then 01#63 (a
mechanism swap that keeps the goal), then 01#65 (a taste decision that wants an
owner).

## 23. 03#18 — the pattern the audit says to copy only half exists

The finding tells the customers table to move `q` and `filter` into the URL and
the server loader, "matching the pattern `activity-detail-feed.tsx:235-267`
already uses". I read that pattern. It is two different decisions, and neither
transfers.

**`filter` — activity pushes it server-side; customers cannot.** Activity's
filter maps to `eventsForCategory(filter)`, an `event_name IN (…)` predicate on
a real column, served by a composite index. The customers filter tests
`row.badge.tone === "ready" | "quiet"` and `isActiveMember(row)` — values
DERIVED in `buildMerchantCustomerReadback`, not stored. Pushing it down means
reimplementing badge derivation in SQL, which is exactly the duplication 03#13
was declined for: two implementations of the same rule, drifting, over audited
loyalty data.

**`q` — activity deliberately does NOT push it server-side.** Its loader says
why: the only first-class text column is `event_name`, and the richer joins
carry PII that must not reach a search predicate. The customers table is worse
on that axis, not better — its identifiers are masked initials over hashed
phones, so there is no plaintext column to match against at all.

So the existing note ("a data-layer + privacy design change, not a UI fix") is
right, and this is what it looks like concretely. The honest options are a
materialised badge/searchable column with its own drift story, or leaving search
page-scoped and saying so — which the table already does, in the disclaimer the
audit wants deleted.

Deleting that disclaimer without fixing the search underneath it would be the
one genuinely bad outcome available here.

## 24. A claims gap the audit missed, and the contract already knew about

Found while verifying 01#38's "[stale]" note. Worth reading even if nothing else
here gets actioned, because it is the only item in this document that is about
what the site _claims_ rather than how it looks.

`tests/contracts/marketing-offer-source.test.mjs` enforces a rule, not a page
list: **any marketing surface that names a guarantee must also render
`CLAIMS_BOUNDARY`** — its limits. The test then allowlists two files:

```
"components/marketing/guides/guide-page.tsx",
"components/marketing/guides/guides-data.ts",
```

with a comment calling it a "KNOWN PRE-EXISTING GAP … closing it is tracked
separately because it edits three indexed pages' copy, which is outside the
re-role's approved scope."

Verified against the tree: both files print `${GUARANTEE.name}: ${GUARANTEE.line}`
in the guides' closing CTA, and `CLAIMS_BOUNDARY` appears nowhere under
`components/marketing/guides/`. So the three `/guides/*` pages — which are
indexed — state a guarantee without its limits.

**The audit never mentions this.** Its only `CLAIMS_BOUNDARY` finding is 01#38,
which asks for the boundary to be stated _less often_ on the landing. So the
audit is asking to reduce the boundary where it is present, and is silent where
it is absent.

I have not fixed it. It is an addition to marketing copy on three indexed pages
and it is a claims question, which is the category this campaign has
consistently escalated rather than guessed at (see 01#67). But it is a different
kind of open item from the rest of this document: everything else here is a
design or performance tradeoff, and this is a statement about a commercial
guarantee appearing without its conditions.

The fix is small — render `CLAIMS_BOUNDARY` beside the guarantee in the guides'
closing CTA, then delete those two entries from the contract's allowlist, which
will then enforce it forever.

## 25. Two customer findings closed by measurement, recorded so they stay closed

Neither needs a decision. Both were held open by a claim that measurement
disproved, and both are the kind of claim that comes back.

**02#2 — the header cannot get any shorter.** Measured at 390px in Chromium on
`/dev/home-harness/home`: the authed header is **62px** (`py-2` + a 2px rule).
The `Logo` carries its own `min-h-11`, so 44px of that 62px is the wordmark.
Deleting the entire `<form>` around "Log out" from the DOM leaves the header at
**62px**. Relocating the action to the Profile tab saves nothing; the audit's
"≈24px" was banked when `py-3` became `py-2`.

The blocker recorded against it — "icon-sm refused (CUS-P2-14)" — was wrong.
CUS-P2-14 asserts exactly one thing:

    assert.doesNotMatch(shell, /size="sm"/)

`size="icon-sm"` does not match that pattern (checked in node), and `icon-sm`
carries `[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11`,
so on the phones this finding is about it _is_ a 44px target. The contract
permits it. It stays refused because it trades a labelled destructive action for
an icon and saves zero pixels.

**02#6 — `@container` would convert the wrong 15 declarations.** After fixing
the three live defects the earlier sweep missed, every remaining viewport
variant in the customer column is a page gutter or page top/bottom padding on
one of four shell files:

| file                       | live variants                               |
| -------------------------- | ------------------------------------------- |
| `customer-shell.tsx`       | `sm:px-6 sm:pt-10 sm:pb-10`                 |
| `customer-app-shell.tsx`   | `sm:px-6` ×2                                |
| `customer-flow-system.tsx` | `sm:px-6`, `sm:pt-6/8`, `sm:pb-[max(…)]` ×2 |
| `loading-skeletons.tsx`    | the same five, mirroring the flow shell     |

Those measure the gap between the column and the **screen edge**. A container
query on `max-w-customer` cannot express them, because that container is a
constant 410px — converting them would freeze the page gutter at its phone
value on every desktop. The audit also names `components/brand/typography.tsx`,
which is not a customer file: `PageTitle`/`SectionHeader` have call sites in 9
merchant directories, 9 marketing ones and 8 admin ones, so converting its `md:`
action rail would relayout every console and marketing page to fix a customer
finding.

## 26. The merchant setup reminder: 172-268px on every console route, and the audit's fix costs more than it saves

03#1's second half asks for the setup reminder to become "a _slot_ the page opts
into next to its title (or a one-line strip inside `PageTitle`'s `actions`)
rather than an unconditional stacked card". The word "unconditional" was wrong
and the note carried it for the whole campaign — `app/app/layout.tsx` renders
`<MerchantSetupReminder>` inside `<Suspense>`, and the component returns null on
`/app/onboarding`, `/app/launch` and the four print previews
(`shouldShowMerchantSetupReminder`) and again whenever `readiness.launchReady`.
It appears only while a venue is genuinely unlaunched, and disappears for good
the moment it launches.

What it costs while it is there, measured on the dashboard harness (top of the
page `<h1>`, launch-ready vs setup-incomplete):

| viewport | h1 top, ready | h1 top, incomplete | pushed down | card height |
| -------- | ------------: | -----------------: | ----------: | ----------: |
| 320px    |         109px |              377px |       268px |       233px |
| 390px    |         109px |              353px |       244px |       209px |
| 768px    |          66px |              271px |       205px |       185px |
| 1280px   |          59px |              231px |       172px |       137px |

On a 390x844 phone that is 29% of the first screen, on every console route, for
the whole pre-launch period.

**Why I have not converted it to a slot.** Two costs, one of them structural:

1. A slot is an opt-in on every console page. A page that forgets it silently
   drops the only surface telling a merchant why their venue is not live. The
   layout version cannot be forgotten.
2. The dashboard already shows readiness twice while incomplete — this card
   ("Next: Your rewards" / "Add rewards") and the `PageTitle` action
   ("Finish setup"), 172px apart at 1280 and pointing at the same place. A slot
   next to the title would put them adjacent rather than remove either.
   Multiplying readiness representations is precisely what 03#43 spent its
   effort undoing and what 03#3 declined to add a third of.

**The decision that is actually available**, with the number attached: the
compact card spends roughly 48px of its 209px on `stepHint`, a sentence that
repeats what `/app/launch` says on arrival ("Add at least three live rewards so
every full card has something to reveal."). Dropping it below `sm` would take
the phone cost from 244px to ~196px on seven routes. That is a content
judgement about the pre-launch console, not a layout one, so it is here rather
than in a commit.

## 27. RA-11's fixed reward tray overlays 208px of the phone viewport, and that is the thing the audit wanted removed

03#47 asks for the reward-pool selection bar to become
`sticky bottom-0` so it "participates in flow and the `pb-[8.75rem]` hack
disappears". `tests/contracts/reward-preset-atomic-add.test.mjs` lines 109-111
pin the opposite — `fixed … sm:static`, the `editingId === null … fixed` guard,
and `pb-[8.75rem] … sm:pb-6` — so the change cannot be made without editing
assertions. It has not been made.

Two of the finding's supporting claims are now measurably stale, and one cost is
measurably real.

**Stale — "the spacer is guesswork".** Measured at 320, 360 and 390px for every
selection count from 1 to 7: the tray renders at exactly **140px** in all 21
cases. `pb-[8.75rem]` is 140px. The wrap the finding predicts ("two lines of
copy + a two-button row wraps differently at 320px") does not happen, because
the copy was shortened to one line plus one sub-line and the buttons sit in a
fixed `grid-cols-[auto_minmax(0,1fr)]` row.

**Stale — "shorten the bar to one line with the two buttons inline".** At 320px
the tray's inner width is 272px. The count line alone measures 202px and the two
buttons 76px and 184px, so the single-line layout needs about 478px. It does not
become possible on any phone in the matrix.

**Real — the overlay.** The tray floats `calc(3.5rem + max(0.75rem, env(safe-area-inset-bottom)))`
above the viewport bottom (the console tab bar plus a gutter), so its total
footprint is **208px** of overlaid viewport on a device with no home indicator
and **230px** on one with a 34px inset. At maximum scroll on `/app/launch?tab=rewards`
with a selection pending, that band covers the birthday-reward toggle's
checkbox: a Playwright click on `input[name="enabled"]` times out as
unactionable there. The surrounding `<label>` is still partly tappable, so this
is degraded rather than blocked — but it is a control the merchant cannot hit
directly, and it is below the component that owns the spacer, so no change
inside `reward-pool-form.tsx` can reach it.

That last point is the whole argument in one line: a `fixed` bar's clearance
belongs to the scroll container, and the contract pins the clearance to the
section. A `sticky` bar would not have the problem, which is what 03#47 said.

**The decision:** whether RA-11's intent ("one mobile-persistent Add action that
never needs scrolling to reach") is satisfied by `sticky bottom-0` — which also
never needs scrolling to reach — or whether the assertion is meant to pin
`fixed` specifically. Only the author of RA-11 can say. If it is the intent, the
three pinned literals can be re-expressed and 03#47 closes; if it is the
mechanism, 03#47 should be marked declined rather than partial, and this section
is the reason.

## 28. Report 01 — three marketing judgements, now measured

All three were recorded as "needs a decision" or "wants a browser". Two of them
are now decided by measurement and closed against the numbers below; the third
is still a decision, but a narrower one than the note implied.

### 01#30 — two-columning the pricing sheet: measured and declined

Chromium, `/pricing`, `[data-growth-plan-pricing]`:

| viewport | sheet height, one column | with `grid-cols-[1.1fr_0.9fr]` |      delta |
| -------- | -----------------------: | -----------------------------: | ---------: |
| 390      |                  1,585px |            n/a (single column) |          — |
| 768      |                  1,119px |                        1,552px | **+433px** |
| 1024     |                  1,001px |                        1,004px |       +3px |
| 1280+    |                    977px |                          908px |  **-69px** |

The sheet caps at 1,088px wide, so nothing changes above 1280. The 768px
regression is the `ol`: its `10.5rem` label track plus a sentence does not fit a
0.9fr rail, and the three rows go from 246px to 918px. Moving the threshold to
`lg:` removes that regression and leaves a best case of -69px (-7%) on one
breakpoint.

The audit's "= 450px on tablet+" was priced before the `ol` fix that has already
shipped, which is where the saving actually went (`ol` at 1280: 174px). Not
shipped. If anyone wants to revisit, the missing ingredient is a narrower label
track inside a rail, not the two-column grid.

### 01#22 — collapsing four of the five launch steps on mobile: rejection confirmed

Measured at 390x844 on `/how-it-works`:

| thing                              |                      value |
| ---------------------------------- | -------------------------: |
| document height                    |                    6,211px |
| `#launch` section                  |                    1,372px |
| the steps `<ol>` alone             |                    1,101px |
| the `<ol>` at 1280                 |                      677px |
| saving from a `<details>` collapse | ~725px (11.7% of the page) |

The rejection stands and now has its number: 11.7% of the page, bought by
hiding four of five steps on the page whose job is to explain them. The audit's
"= 900px" was priced against the ~1,250px vertical stack that the horizontal
conversion has already removed.

### 01#20 — a compact GrowthPlanPricing on `/`: still a decision, and not contract-blocked

Two things the note did not say.

It is **not** contract-blocked. `marketing-offer-source` pins the string
`<LandingPricing` into the landing's seven-band ORDER; it says nothing about
what that component renders, so its interior can be swapped whenever the
presentation is decided.

Both remaining halves are the **same** decision. "Drop See full pricing" only
becomes redundant once `/` shows the real sheet, so it cannot be actioned on
its own.

I looked for an objective divergence hiding behind the decision and did not
find one. In particular the landing's `SeasonalOfferBanner` is
`CampaignStrip variant="card"`, which does render `offer.termsLine`, so the
seasonal terms are published on both surfaces. What is left is presentation:

| aspect       | `/pricing`                                      | `/`                               |
| ------------ | ----------------------------------------------- | --------------------------------- |
| container    | `PricingSheet`, 18px ink sheet, bonded strips   | `Card border-primary`             |
| `OFFER.name` | `<h2>` at 24/30px                               | `<p>` at 14px                     |
| annual       | `PriceLockup size="lead"` + `annualSavingShort` | "Or {annualPrice}" + "Best value" |
| timeline     | 3-row `ol` (174px at 1280)                      | absent                            |
| CTAs         | 1                                               | 2                                 |

## 29. `deadcode:check` structurally cannot report an unused export

Found by the design-system lane while sweeping contract allowlists, verified
here.

`package.json` runs `knip --include files,dependencies,unresolved`. The
`exports`, `types`, `nsExports` and `duplicates` rules are therefore never in the
output, and `knip.json` sets them to `warn` regardless. So a green
`pnpm deadcode:check` says nothing at all about unused exports.

Enabling the rule reports **78 unused exports** on a conservative count (the lane
counted 236 including types and namespace exports). Removing the
`components/ui/**` entry pattern surfaces eight more on top: `AlertAction`,
`badgeVariants`, `CardFooter`, `CardAction`, `EmptyMedia`, `SheetClose`,
`SheetFooter`, `TableFooter`.

This is the same blind spot that let 05#27's six dead `field.tsx` exports survive
a green gate — they had **two** independent reasons to be invisible.

Not turned on here: switching the rule from `warn` to `error` is a 78-to-236 item
decision with a real chance of deleting something a future feature wants, and it
belongs to whoever owns the dependency graph. But the current gate's name
promises something it does not deliver, and that is worth knowing before trusting
it.

Related and also unactioned: `components/merchant/launch/launch-billing-cta.tsx`
is dead — zero references outside itself — and two mechanisms keep it alive. It
is listed as an `entry` in `knip.json`, and `launch-billing-local-stripe` asserts
the symbol exists. Deleting it means deleting a contract assertion, so it is
escalated rather than done.

### CLOSED — resolved with a ratchet, not a decision

`pnpm deadexports:check` (in `quality:check`) now reports unused exports. The 233
pre-existing ones are baselined in `config/dead-exports-baseline.json` and
tolerated; a NEW one fails, and so does deleting a baselined one without pruning,
so the count can only fall.

No sign-off needed. The debt is unchanged but bounded, and the gate is no longer
blind to the most common form of dead code in the repo.

## 30. The fraud queue cannot be paged without a rank column (04#6)

Five of the eleven admin lists now have venue lookup and a paginator. The fraud
queue is the one that stopped, and not for want of trying.

`getAdminFraudSignals` fetches a window and then sorts it **in memory**:

```js
flags.sort((left, right) => FRAUD_SEVERITY_RANK[left.severity] - …)
```

because `severity` is a text column whose alphabetical order — high, low,
medium — is not its severity order. That is fine for one window. Page it
server-side and each page gets sorted independently, so a **high**-severity flag
on page 3 sits below a **low**-severity one on page 1. A triage queue that
reorders by accident is worse than a long one.

Two honest fixes, both data-layer:

1. **A `severity_rank` smallint** on `fraud_flags`, written alongside
   `severity`, ordered in SQL. Fast, and adds a column that can drift from the
   text one.
2. **Order by a CASE expression** in a view or RPC. No new column, but PostgREST
   cannot express it through the query builder, so it needs a database object.

Until then the queue keeps its 100-row window and its truncation notice, which
tells the truth.

This is the same shape as 03#18, and worth stating as a rule: **the audit's
"page it like the others" transfers only where the underlying read is already
ordered the way the page displays it.** Merchants, audit, billing, referrals and
the evidence ledger all are. Fraud and the members table are not.

## 31. Three venue spokes are unreachable and unindexed, awaiting a decision the code calls pending

`/loyalty-for-cafes`, `/loyalty-for-bars` and `/loyalty-for-takeaways` are
complete, well-written pages that:

- have **no inbound link** from anywhere on the site (crawled every internal
  `<a href>` on every public route);
- are **not in `PUBLIC_SITE_ROUTES`**, so they are not in the sitemap;
- carry `robots: { index: false, follow: true }`, set deliberately by
  `personaPageMetadata` for every non-primary persona;
- each carry a `navLabel` ("Cafés", "Bars", "Takeaways") that **no component
  renders**.

The code states the intent: _"Keep discovery flowing to the supported pub-first
offer while these unsupported vertical spokes await traffic/backlink evidence for
a safe 301, consolidation, or retention decision."_

So this is not a bug, and I reverted my own fix for it. The sitemap omission is
correct for noindex pages, and adding hub links promotes pages that were
deliberately de-emphasised.

**But the pending decision is now several months old and has a cost.** The three
pages are maintained — they are covered by `marketing-offer-source`, they render
the same offer engine, they will keep appearing in every refactor — while being
reachable only by typing the URL. The unrendered `navLabel` is the tell that a
navigation was specified and then dropped.

The three options the comment names, with what each implies:

| option          | implies                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Retain**      | link them from `HubHandoff`, drop `index: false`, add to `PUBLIC_SITE_ROUTES`. Treats them as real pages. |
| **Consolidate** | 301 each to `/loyalty-for-pubs`, delete the routes, keep `PERSONAS` for copy. Stops paying maintenance.   |
| **Hold**        | status quo — but then `navLabel` should be deleted, because it advertises a nav that is not coming.       |

Recommendation: **hold or consolidate**, not retain. Nothing in the repo suggests
the traffic/backlink evidence arrived, and retaining is the only option that
changes public SEO posture.

This needs a marketing/SEO owner, not an engineer.
