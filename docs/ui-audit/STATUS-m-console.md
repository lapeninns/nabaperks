# STATUS — counter-first venue console rebuild

**Spec:** [`counter-console-rebuild/handoff-counter-console-implementation.md`](counter-console-rebuild/handoff-counter-console-implementation.md)
(the prototype and the 375px "before" strip sit beside it).
**Audit source:** `03-merchant.md` §1 (shell), §2 (dashboard) — the twelve
failures in the handoff's §1 table.
**Branch convention:** `codex/console-l<N>-<lane>`, one PR per lane, stacked
on the previous lane until it merges.

## Lanes

| Lane | Scope (handoff §14)                                                                                                          | State     | PR                                                      | Notes                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1   | Nav model: `merchantTabItems`, More aliases, `resolveMerchantTab`, unit tests                                                | merged    | [#347](https://github.com/lapeninns/nabaperks/pull/347) | Pure functions only. Merged to main 2026-09-21.                                                                                                                                                                                    |
| L2   | Shell: three-row grid + rail column, `MerchantTabBar`, top bar, skip link, sidebar out                                       | in review | [#348](https://github.com/lapeninns/nabaperks/pull/348) | Pinned row is `ConsolePinnedAction`, rendered by the owning screen as a sticky footer inside the scrolling body row (no portal, no layout shift). Offline strip, billing strip and the console analytics contract landed here too. |
| L3   | Counter: `PresentableQrCard`, `TeamCodePanel`, `ResetCodeSheet`, present mode, pinned scanner; metrics and activity move out | in review | [#349](https://github.com/lapeninns/nabaperks/pull/349) | Numbers also joins the ≥900px rail so the wide layout reaches every tab.                                                                                                                                                           |
| L4   | Numbers overview: `ColumnChart`, delta receipt, range, low-data bands                                                        | in review | [#350](https://github.com/lapeninns/nabaperks/pull/350) | 28-day range needs `dashboard-query.ts` to take a day count; that file is sign-off gated (§16.6), so the first cut ships 7 and 14.                                                                                                 |
| L5   | Numbers detail `/app/numbers/[metric]`                                                                                       | in review | [#351](https://github.com/lapeninns/nabaperks/pull/351) | Rewards series is labelled "Rewards unlocked" until `redeemed_at` is exposed.                                                                                                                                                      |
| L6   | Activity grouping, scope, filters                                                                                            | in review | [#352](https://github.com/lapeninns/nabaperks/pull/352) | Only `qr_scanned` / `customer_joined` collapse; `since` is pushed into the activity query.                                                                                                                                         |
| L7   | More, live subtitles, 900px redirect                                                                                         | in review | [#353](https://github.com/lapeninns/nabaperks/pull/353) | Live subtitles read the notification ledger and the live offer campaign name.                                                                                                                                                      |
| L8   | Sweep: skeletons, harness, visual and a11y suites, bundle, dead code                                                         | in review | [#354](https://github.com/lapeninns/nabaperks/pull/354) | Lands the whole stack (L2–L8 merged forward) as one merge to main.                                                                                                                                                                 |

## Review follow-ups (Codex, 2026-09-21)

Each lane branch carries a `fix(...): review follow-ups` commit answering
that lane's inline findings; later lanes merge the earlier fixes forward.
Decisions that changed under review:

- The rewards daily series buckets unlock dates (the series query is
  sign-off gated), so the detail screen labels it "Rewards unlocked" and
  keeps the week comparison as "Rewards redeemed".
- The Activity scope and category controls are URL state rendered outside
  the feed's boundary, so a failing query never removes them; the
  "one row hides the pills" rule is dropped because a one-result filter
  must still be undoable.
- The first stamp is read from `stamp_events` (event_type earned), the same
  ledger as the counts, and a failed read rejects the stream rather than
  reading as "never stamped".
- More's Poster row reports "Print kit downloaded" / "No download yet"
  (the durable signal); "Last sent" reads the notification ledger; Account
  reads the launch billing readiness ("not started", "not required").
- Two findings are answered rather than changed: the Numbers lane's interim
  metrics stream labels (superseded by L4, which removed the stream) and
  the L8 status-ledger note (the ledger was updated in that same commit).
- Visual baselines: the existing harness baselines that the shell reshapes
  (`harness-dashboard*`, `harness-qr*`, `harness-launch-billing*`,
  `harness-offers-*`) were regenerated inside the CI-pinned
  `mcr.microsoft.com/playwright:v1.62.1-noble` image (same digest as
  `ci.yml`) and committed on the L8 branch.
- Deferred, and currently not staged: adding the console routes, the
  greyscale receipt and the 320–1024 breakpoint matrix to `visual.spec.ts`,
  and the numbers / more / billing / paused lanes to the a11y sweep. #355
  staged those copies (7f563f9a), but they could not activate without Linux
  baselines for the new visual tests, so the hosted speed-ups staging PR
  withdrew them to byte-identical mirrors. To restore the coverage, re-stage
  both copies from 7f563f9a together with console baselines generated in the
  CI image; this still needs a tracking issue. Those
  two files sit in the CI selection dependency graph, so editing them turns
  a product PR into a qualification-policy change that needs a
  `config/ci-qualification-inputs/<path>.source` review. The console specs
  register their lanes through `tests/e2e/helpers/console-harness.ts`
  instead, and the per-lane axe checks live in the flow specs.

## Open tickets this rebuild needs from the data layer

- **Numbers breakdowns (§6.3.2).** No query exists for joins by channel (QR / team code / invite), stamps by hour of day or by claim method, the reward lifecycle split (unlocked / redeemed / expired / sent) with median days to redemption, or QR scans vs downloads vs poster prints. Each is a new aggregate over `product_events` (or the stamping wrapper's rows) and needs a product decision on definitions before it is drawn.
- **28-day range (§6.3.1).** `getMerchantDashboardSeriesByQuery` builds `DASHBOARD_SERIES_DAYS = 14` buckets; a `days` parameter on it (and on the `get_merchant_dashboard_series` RPC's `p_days`) unlocks 28. That file is sign-off gated (§16.6).

## Deviations from the handoff, with reasons

- **Pinned slot mechanism (§5.1).** The handoff describes a fourth grid row
  the shell exposes as a named slot. A server-rendered page cannot pass a
  node up into a shared layout without a portal, and a portal mounts after
  hydration, which shifts the QR card at the till. `ConsolePinnedAction`
  therefore renders inside the body row as `sticky bottom-0 mt-auto`: same
  outcome (never scrolls off, collapses to nothing when a screen does not
  render it), no client-only mount.
- **Poster print top bar (§7.1).** The poster chrome's mobile hamburger
  opened the old sidebar drawer. There is no drawer now; the chrome keeps its
  Back button and the rail from 900px.

## Verification ledger

Filled per lane as checks run; hosted CI stays authoritative.

| Lane | Local checks run                                                                                                                                                                                                                             | Not run locally                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| L1   | unit (console-nav), nav contracts, typecheck, scoped lint                                                                                                                                                                                    | build                                                                                             |
| L2   | unit, contracts, typecheck, scoped lint, tokens:check, shell e2e (mobile-safari + chromium), axe on five harness lanes                                                                                                                       | build, visual baselines (harness screenshots change shape; hosted Linux run must regenerate them) |
| L3   | unit (counter-qr-state, team-code-rotation), contracts, typecheck, scoped lint, Counter + shell + launch follow-through + smoke e2e and axe on dashboard/skeletons lanes (mobile-safari + chromium), browser check at 375, 844×390 landscape | build, desktop-firefox/safari, visual baselines (`harness-dashboard*` change by design)           |
