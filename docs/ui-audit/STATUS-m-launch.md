# UI audit status — merchant launch / onboarding / card lane

Branch `feat/ui-audit-m-launch`. Findings 03#42–03#50 from
`docs/ui-audit/03-merchant.md`. Every row was re-read against the current
source before any edit; several were already fixed by earlier waves.

Gates run on every commit: `pnpm typecheck`, `pnpm lint`, `pnpm quality:fast`
(960 tests), `pnpm build`. No browser tiers (`test:e2e`, `test:a11y`,
`test:visual`) and no DB tier were available in this lane.

| ID    | Priority | State       | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 03#42 | Medium   | [x] done    | Two heading blocks collapsed into one `PageTitle`; only the supporting line swaps at `sm`. Both copy strings kept verbatim.                                                                                                                                                                                                                                                                                                                                                                                        |
| 03#43 | High     | [~] partial | Deleted the desktop `ProgressTrack` and both duplicate "N / M" MonoTags — one readout per breakpoint now. The 545→250 line target was NOT met: the rest of the file is the compact variant (dashboard reminder) and the non-tab full variant, which are other surfaces, not repeats.                                                                                                                                                                                                                               |
| 03#44 | Medium   | [stale]     | The readiness ink CTA strip is already gated on `!tabMode`, so it cannot render beside `LaunchFlowFooter` on the launch hub. Only the footer's empty line was real: "Keep your setup moving" → "Continue to {next step}". Button labels untouched (pinned by the launch-header e2e).                                                                                                                                                                                                                               |
| 03#45 | Medium   | [x] done    | Onboarding is a two-child grid: one left lane holds title + summary + form, the roadmap aside is the second child. Dropped the `ReceiptCard` that framed a heading and nothing above `lg`. The shared orientation component keeps its placement classes because the /dev harness (out of scope here) still composes three children.                                                                                                                                                                                |
| 03#46 | Medium   | [~] partial | The `SubmitButton` half was STALE — already adopted. Added blur-time validation for the five required fields, change-time clearing, and a visible `role="alert"` summary of every invalid field as 44px anchor links. Postcode/city auto-formatting deliberately left: that is server-side normalisation, not UI.                                                                                                                                                                                                  |
| 03#47 | High     | [~] partial | Presets now sit in the existing `Disclosure`, open on first paint only while the pool is below the launch minimum (frozen at mount). Tray shortened by a line. The sticky-footer + delete-`pb-[8.75rem]` half is REFUSED: `tests/contracts/reward-preset-atomic-add` (RA-11) pins `fixed … sm:static` and that spacer, and contracts outrank the audit. Fixed instead a defect the audit predates — the tray sat under the new md:hidden console tab bar; it now clears 3.5rem + safe area with a matching spacer. |
| 03#48 | Medium   | [x] done    | Mostly STALE: no 1px section border, no `border-[1.5px]` rows, no `rounded-2xl` toggle — all already normalised. Remaining real items done: editor submit → `SubmitButton pendingLabel="Saving…"`, edit button off the one-off `rounded-md`.                                                                                                                                                                                                                                                                       |
| 03#49 | Medium   | [~] partial | Extracted `components/merchant/launch/form-action-bar.tsx` (sticky <sm, static sm+, 2px ink rule, safe-area padding, explicit `offset` for the two console chromes) and adopted it on the card, venue and onboarding forms, with an "Unsaved changes" indicator on the card form. `profile-form.tsx` and `announcement-compose.tsx` are outside this lane's file scope and are left to their owners.                                                                                                               |
| 03#50 | Medium   | [x] done    | Cadence presets are now the primary control (count as a 24px mono numeral, `min-h-14`, selected = 2px ink + `bg-secondary` + check, no ink fill); the stepper is a demoted "Or set a custom number" row linked by `aria-describedby`, and its readout moves off `border-x-[1.5px]`.                                                                                                                                                                                                                                |

Counts: 4 done, 4 partial, 1 stale, 0 open.

## Not attempted, and why

- **Browser-verified anything.** No `test:e2e` / `test:visual` run in this lane.
  The tab-bar clearance values (3.5rem + safe area) are read from
  `components/layout/merchant-tab-bar.tsx`, not measured in a viewport.
- **`app/dev/app-harness/launch/page.tsx` and `.../onboarding/page.tsx`.** Out
  of scope. They still carry the old duplicated launch heading block and the
  three-child onboarding grid, so harness and production have DIVERGED for
  03#42 and 03#45 — the e2e/visual suites drive the harness, so someone who
  owns `app/dev/**` should mirror both changes.

## Bug found that the audit missed

`/app/launch` is no longer a "setup shell" path (only `/app/onboarding` is, per
`lib/navigation/merchant-shell.ts`), so the launch hub renders the FULL shell —
including the new `md:hidden` bottom tab bar. Two fixed/sticky action surfaces
on the launch-critical steps were therefore sitting UNDERNEATH it on a phone:
the reward-pool selection tray (its Clear/Add row) and the card form's sticky
Save. Both are fixed here; any future sticky-bottom surface on a full-shell
route needs the same clearance.
