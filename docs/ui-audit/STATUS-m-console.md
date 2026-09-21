# STATUS — counter-first venue console rebuild

**Spec:** [`counter-console-rebuild/handoff-counter-console-implementation.md`](counter-console-rebuild/handoff-counter-console-implementation.md)
(the prototype and the 375px "before" strip sit beside it).
**Audit source:** `03-merchant.md` §1 (shell), §2 (dashboard) — the twelve
failures in the handoff's §1 table.
**Branch convention:** `codex/console-l<N>-<lane>`, one PR per lane, stacked
on the previous lane until it merges.

## Lanes

| Lane | Scope (handoff §14)                                                                                                          | State       | PR                                                      | Notes                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1   | Nav model: `merchantTabItems`, More aliases, `resolveMerchantTab`, unit tests                                                | open        | [#347](https://github.com/lapeninns/nabaperks/pull/347) | Pure functions only.                                                                                                                                                                                                               |
| L2   | Shell: three-row grid + rail column, `MerchantTabBar`, top bar, skip link, sidebar out                                       | open        | see below                                               | Pinned row is `ConsolePinnedAction`, rendered by the owning screen as a sticky footer inside the scrolling body row (no portal, no layout shift). Offline strip, billing strip and the console analytics contract landed here too. |
| L3   | Counter: `PresentableQrCard`, `TeamCodePanel`, `ResetCodeSheet`, present mode, pinned scanner; metrics and activity move out | not started |                                                         |                                                                                                                                                                                                                                    |
| L4   | Numbers overview: `ColumnChart`, delta receipt, range, low-data bands                                                        | not started |                                                         | 28-day range needs `dashboard-query.ts` to take a day count; that file is sign-off gated (§16.6), so the first cut ships 7 and 14.                                                                                                 |
| L5   | Numbers detail `/app/numbers/[metric]`                                                                                       | not started |                                                         |                                                                                                                                                                                                                                    |
| L6   | Activity grouping, scope, filters                                                                                            | not started |                                                         |                                                                                                                                                                                                                                    |
| L7   | More, live subtitles, 900px redirect                                                                                         | not started |                                                         |                                                                                                                                                                                                                                    |
| L8   | Sweep: skeletons, harness, visual and a11y suites, bundle, dead code                                                         | not started |                                                         |                                                                                                                                                                                                                                    |

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

| Lane | Local checks run                                                                                                       | Not run locally                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| L1   | unit (console-nav), nav contracts, typecheck, scoped lint                                                              | build                                                                                             |
| L2   | unit, contracts, typecheck, scoped lint, tokens:check, shell e2e (mobile-safari + chromium), axe on five harness lanes | build, visual baselines (harness screenshots change shape; hosted Linux run must regenerate them) |
