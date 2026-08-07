# Area 01 — Public marketing surface: fix status

Branch `feat/ui-audit-marketing`. Every row below was checked against the code
before it was actioned; `[stale]` means the report describes a revision that is
no longer what ships, or asks for something a contract test forbids.

**69 findings — 39 done, 17 partial, 10 open, 3 stale.**
Findings 63–69 are the legal surface and are out of this lane's scope.

| ID    | Priority | Status  | Note                                                                                                                                                                                                                  |
| ----- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01#1  | Critical | [x]     | Mobile link rail (`MarketingHeaderRail`) under the header below `md:` — same four destinations, `min-h-11` chips, no hamburger, no focus trap.                                                                        |
| 01#2  | High     | [~]     | Footer 4-across from `sm:`; legal row now one wrapped sentence of 36px targets (~90px saved). `<details>` disclosure rejected: no cross-browser JS-free way to force one open above a breakpoint.                     |
| 01#3  | High     | [x]     | Section scale made monotonic at BOTH breakpoints (default/dense/compact/tight); no page grows on mobile.                                                                                                              |
| 01#4  | Medium   | [x]     | `MARKETING_GUTTER` (`px-6 lg:px-8`) on Section, ContrastBand, header and both footers. Kept 24px on mobile — SnapRail's `-mx-6 px-6` bleed is measured against it.                                                    |
| 01#5  | Medium   | [~]     | `MARKETING_ANCHOR_OFFSET` now drives Section, ContrastBand and GuideSection. The `--marketing-header-h` custom property needs app/globals.css (out of scope); legal spine's `lg:top-20` untouched.                    |
| 01#6  | Low      | [~]     | Header nav pills → `rounded-(--radius-md)`. Footer halo left alone: DESIGN.md names the legal-link halo family as a sanctioned exception.                                                                             |
| 01#7  | Low      | [x]     | SkipLink now `.focus-ring` + `--radius-lg` + `shadow-sm` + `min-h-11`.                                                                                                                                                |
| 01#8  | Medium   | [x]     | ContrastBand padding aligned to the Section scale; both call sites use `dense`.                                                                                                                                       |
| 01#9  | High     | [~]     | ProofLine restyled (see 18). Marquee NOT deleted from `/` — tests/contracts/marketing-offer-source pins it into the landing's seven-band order.                                                                       |
| 01#10 | High     | [stale] | Won't-fix: the same contract test requires `<FinalCta` on the landing. Its padding override was fixed instead (21).                                                                                                   |
| 01#11 | High     | [stale] | Already `sm:grid-cols-2 md:grid-cols-3` in ProductMoment — the audit describes an older revision.                                                                                                                     |
| 01#12 | Critical | [~]     | Already largely swept to `md:`; the only remaining `lg:`-first splits are the three heroes, which NEEDS-SIGNOFF item 3 blocks on a browser.                                                                           |
| 01#13 | High     | [x]     | `<Suspense>` around CommercialEvidenceProof so a DB read no longer gates the hero's TTFB. Empty case still renders nothing (claims-boundary contract).                                                                |
| 01#14 | High     | [~]     | ProductMoment h2 pinned to the band step. `SectionHeader size` prop not shipped — components/brand is shared with the consoles.                                                                                       |
| 01#15 | Medium   | [~]     | Added the missing middle step (`sm:text-5xl lg:text-6xl`) so the 36→60px snap is gone. No 56px token exists in DESIGN.md; the display rank is open in NEEDS-SIGNOFF.                                                  |
| 01#16 | High     | [x]     | `MARKETING_TEXT_LINK` (44px) at the five standalone sites. In-sentence links keep their inline box (WCAG 2.5.8 exempts them).                                                                                         |
| 01#17 | High     | [~]     | Pause/Play toggle on the hero card. Timer-chain teardown and the marquee's keyboard pause need components/loyalty + components/motion (other lanes).                                                                  |
| 01#18 | Medium   | [x]     | ProofLine is now a numbered ledger: mono index, dashed rules below `sm:`, 2-up at `sm:`, 4-up at `lg:`.                                                                                                               |
| 01#19 | Medium   | [x]     | FitNote is a left-aligned two-column band; criteria via the existing PlanIncludesList, disqualifier as a dashed aside.                                                                                                |
| 01#20 | High     | [~]     | Full `PLAN_INCLUDES` (was `slice(0,4)`) and TakeoverAnchor stacked below, not beside. A `GrowthPlanPricing variant="compact"` is a pricing-presentation decision.                                                     |
| 01#21 | Low      | [x]     | `ReceiptCard padding="lg"` instead of the arbitrary `[--card-spacing:…]`.                                                                                                                                             |
| 01#22 | Critical | [~]     | Page marquee deleted (verbatim duplicate of the ticket 40px above); LaunchSteps goes horizontal at `sm:`/`lg:`. Mobile `<details>` collapse rejected — it hides 4 of 5 steps on the page that exists to explain them. |
| 01#23 | High     | [ ]     | Merging ProblemPains with FeaturesListicle means cutting 8 pains to 5 — copy removal and a product decision.                                                                                                          |
| 01#24 | High     | [x]     | `feature.removes` moves from 10px uppercase mono to `text-sm font-bold` under a mono label.                                                                                                                           |
| 01#25 | High     | [x]     | `<FinePrint>` (12px sentence case) at all nine cancelLine sites; FinePrintStrip too (also improves the merchant billing card, its one other consumer).                                                                |
| 01#26 | Medium   | [x]     | Arrow item is `role="presentation"` (was an aria-hidden `<li>` counted by AT) and visible at every width.                                                                                                             |
| 01#27 | Medium   | [~]     | Swipe hint is `aria-hidden` and `mono-meta` muted. Counter/arrow controls need a client component with scroll state.                                                                                                  |
| 01#28 | Medium   | [x]     | Both halves of `#promise` on one ground at one size. The `lg:` grid the audit reports was already `md:`.                                                                                                              |
| 01#29 | Medium   | [~]     | The `md:` split it asks for was already there; the `SectionHeader` rank is 14's blocked half.                                                                                                                         |
| 01#30 | High     | [~]     | Schedule rows are `sm:grid-cols-[10.5rem_1fr]` so label and sentence share a baseline. Two-columning the whole sheet is a composition judgement wanting a browser.                                                    |
| 01#31 | Medium   | [x]     | `role="group"`/`aria-label` replaced by visible `mono-meta` labels on both schedules.                                                                                                                                 |
| 01#32 | High     | [~]     | Dead `shadow-md` dropped and `--w-shadow-color` re-pointed to paper on both ink subtrees. The button's ink border on ink needs `[data-on-ink]` in globals.css.                                                        |
| 01#33 | Medium   | [x]     | `/` renders the shared `<TakeoverAnchor />`; the forked landing card and its differently-worded disclaimer are gone.                                                                                                  |
| 01#34 | Medium   | [x]     | One `MarketingDisclosure` (44px `text-sm` summary, Hugeicons ±) across both FAQs and both guarantee cards.                                                                                                            |
| 01#35 | Medium   | [x]     | `<ValueMathReceipt rotated? />` used at both call sites.                                                                                                                                                              |
| 01#36 | Low      | [x]     | One FaqList with `numbered`; LandingFaq is a thin alias because the contract pins the name to /faq.                                                                                                                   |
| 01#37 | High     | [x]     | FaqList caps at `max-w-3xl`, answers at `max-w-[68ch]`.                                                                                                                                                               |
| 01#38 | Medium   | [stale] | Won't-fix: the claims-boundary contract requires guarantee-stack.tsx to render CLAIMS_BOUNDARY, and the catch box is how it does.                                                                                     |
| 01#39 | Medium   | [x]     | `/faq` section is `width="narrow"`, so the H1 and the questions share an axis.                                                                                                                                        |
| 01#40 | Medium   | [x]     | One primary + text links on /faq, /about, /demo; persona-page/guide-page/hub-handoff still carry two-button rows.                                                                                                     |
| 01#41 | Medium   | [x]     | /about prose at `text-base leading-7 max-w-[68ch]` in three subheaded sections. All sentences kept verbatim; three new H2s (audit's wording).                                                                         |
| 01#42 | Low      | [x]     | `Section size="last"` replaces the hardcoded `pb-10` at all three call sites.                                                                                                                                         |
| 01#43 | Medium   | [x]     | One `grid gap-6` wrapper owns /demo's rhythm; caveat promoted to `text-sm` in a dashed note.                                                                                                                          |
| 01#44 | Medium   | [x]     | `gap-3` and a labelled merchant lane below the rule. Kept `secondary` over the audit's `outline` — finding 45 calls `outline` a one-off.                                                                              |
| 01#45 | Low      | [~]     | `outline`→`secondary`, plus a polite live region for retry feedback. `href=""` kept: the page is the fallback for ANY offline URL.                                                                                    |
| 01#46 | Medium   | [x]     | Hub gap `gap-8 sm:gap-10 lg:gap-12` with a 2px dashed rule per GuideSection doing the separating.                                                                                                                     |
| 01#47 | High     | [x]     | Below `xl:` the matrix groups by ASPECT (five disclosures, first open) so the four options sit adjacent. All 20 pairs kept.                                                                                           |
| 01#48 | High     | [x]     | Table gated at `xl:`; aspect row header `sticky left-0` for the widths where it still scrolls.                                                                                                                        |
| 01#49 | High     | [ ]     | Blocked by contract: marketing-offer-source pins the exact `hydrated && !open ? …` expression. Fix was written and reverted; needs the contract renegotiated.                                                         |
| 01#50 | Medium   | [x]     | Question is the wider, carded element; our answer is indented prose. `p-3.5` normalised to `p-4 sm:p-5`.                                                                                                              |
| 01#51 | Low      | [x]     | `IconRoundel size="sm"` replaces the hand-rolled 28px circle.                                                                                                                                                         |
| 01#52 | Medium   | [x]     | StaffTime breaks three-up at `md:` instead of `sm:`.                                                                                                                                                                  |
| 01#53 | Medium   | [x]     | Cobalt panel removed; sun sheet sits directly behind the card, tag + demo link become a dashed caption bar (which also gains a 44px target).                                                                          |
| 01#54 | Medium   | [~]     | Hero ramps given their missing middle step (15). Unifying to two named classes touches components/brand + legal and is open in NEEDS-SIGNOFF.                                                                         |
| 01#55 | High     | [ ]     | Collapsing the three spokes to one route or redirecting them is a routing/product decision; writing vertical-specific copy is a copy decision.                                                                        |
| 01#56 | High     | [x]     | Includes use the checked-inclusion idiom; qualify/disqualify use the hub's bordered/dashed card + glyph vocabulary.                                                                                                   |
| 01#57 | Low      | [x]     | `tone="ink"` → `plain` on both disqualify tags.                                                                                                                                                                       |
| 01#58 | Medium   | [x]     | `PriceLockup size="lead"` now leads the spokes' closing block.                                                                                                                                                        |
| 01#59 | High     | [x]     | Visible date formatted from `guide.updatedOn` — the hardcoded '19 July 2026' is gone.                                                                                                                                 |
| 01#60 | Medium   | [~]     | Every guide h2 has a slug id + anchor offset, with a collapsed 'On this page' disclosure. Making GuideSpine generic is a larger refactor of a contract-pinned client component.                                       |
| 01#61 | Medium   | [x]     | Guide prose `text-base leading-7 max-w-[68ch]`; headings `text-xl sm:text-2xl`.                                                                                                                                       |
| 01#62 | Medium   | [x]     | ComparisonTable breaks at `md:`, cards 2-up from `sm:`, redundant nested scroll container removed.                                                                                                                    |
| 01#63 | High     | [x]     | CLOSED by the root agent: TOC moved above the prose and made collapsible (presentation only, no legal text touched)                                                                                                   |
| 01#64 | Critical | [x]     | CLOSED by the root agent: clause bodies now max-w-[68ch] text-base leading-7 on the foreground colour                                                                                                                 |
| 01#65 | High     | [ ]     | BLOCKED BY CONTRACT: legal-heading-structure pins `<h2 className="mono-meta` as a deliberate decision. Attempted and reverted                                                                                         |
| 01#66 | Medium   | [x]     | CLOSED by the root agent: .w-rule replaced with an explicit dashed top border + first:border-t-0                                                                                                                      |
| 01#67 | High     | [ ]     | Out of scope for this lane — legal surface migration needs human sign-off (docs/ui-audit/NEEDS-SIGNOFF.md §4).                                                                                                        |
| 01#68 | Medium   | [ ]     | Out of scope for this lane — legal surface migration needs human sign-off (docs/ui-audit/NEEDS-SIGNOFF.md §4).                                                                                                        |
| 01#69 | Low      | [x]     | CLOSED by the root agent: LegalRelatedLinks shared across all five legal pages, now a labelled nav landmark.                                                                                                          |

## Gates

Every commit on this branch was verified with `pnpm typecheck`, `pnpm lint`,
`pnpm quality:fast` (958 tests) and `pnpm build`; the batches that touched
colour or micro-type also ran `node scripts/check-design-tokens.mjs`.
`pnpm test:e2e` / `test:visual` / `test:a11y` were NOT run — they need a browser.

## Deliberately not done

- **Anything a contract test forbids.** 01#9 (Marquee on `/`), 01#10 (delete
  FinalCta), 01#38 (delete the catch box) and 01#49 (GuideSpine hydration) all
  contradict assertions in `tests/contracts/marketing-offer-source.test.mjs`.
  For 01#49 the fix was written, failed the contract, and was reverted rather
  than editing the test.
- **Shared files outside this lane.** `app/globals.css` (needed for 01#32's
  `[data-on-ink]` rule and 01#5's `--marketing-header-h`), `components/ui/*`,
  `components/brand/typography.tsx` (01#14's `SectionHeader size` prop, which
  the merchant and admin consoles also render) and
  `components/loyalty/use-stamp-journey-loop.ts` (01#17's timer teardown).
- **Copy and product decisions.** 01#23 (cut 8 objections to 5), 01#55
  (collapse or redirect the persona spokes, write vertical-specific copy).
- **Judgements needing a browser.** The three heroes' `lg:`-first column
  splits (01#12), two-columning the pricing sheet (01#30).

## Found while working, not in the report

- `LandingPricing` rendered `PLAN_INCLUDES.slice(0, 4)` while `/pricing`
  rendered all five, so the two routes published different contents for one
  plan. Fixed under 01#20, but it is a commercial-accuracy bug, not a layout
  one.
- The two bespoke-offer renderings also carried differently worded
  enquiry-only disclaimers ("Enquiry only; no online checkout." vs "Not a
  Growth Plan tier — no self-serve checkout."). Now one component, one wording.
- `FinePrintStrip` set ~200 characters of billing disclosure in tracked
  uppercase mono; its other consumer is the merchant billing-activation card,
  so that surface benefits from the 01#25 fix too.
