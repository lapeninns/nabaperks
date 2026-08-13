# 03-merchant.md — print / QR-kit lane (`feat/ui-audit-m-offers`)

Lane scope after the parent's scope correction: `app/app/qr/**`,
`components/merchant/qr-poster/**`, and (granted explicitly) the two QR
workspace files under `components/merchant/launch/`. Findings 03#31–36 were
already landed by the `ui-merchant` lane in `e387cecd` before this lane started
and were NOT re-done here.

Commits on this branch:

| SHA        | Findings        |
| ---------- | --------------- |
| `c74bfa6a` | 03#41           |
| `78304258` | 03#39, 03#40    |
| `071422bb` | 03#37 (partial) |

Every commit was gated with `pnpm typecheck`, `pnpm lint`, `pnpm quality:fast`
(960 tests) and `pnpm build`. `071422bb` additionally passed `pnpm tokens:check`,
`pnpm bundle:check`, `pnpm deadcode:check` and `pnpm duplicates:check`.

## Per-finding status

|     | ID    | Priority | Status                           | Note                                                                                                                                                                                            |
| --- | ----- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x] | 03#31 | Medium   | done by ui-merchant (`e387cecd`) | Step chips. Half the finding was already stale here: the border was `border-2`, not the `border-[1.5px]` the audit quotes; `rounded-full` was real.                                             |
| [x] | 03#32 | High     | done by ui-merchant (`e387cecd`) | Review step: three consecutive banner tones before the only irreversible action.                                                                                                                |
| [x] | 03#33 | High     | done by ui-merchant (`e387cecd`) | Lifecycle confirm rendered above the trigger that summoned it. Verified real in this worktree before the scope correction.                                                                      |
| [x] | 03#34 | Medium   | done by ui-merchant (`e387cecd`) | Five metric tiles at `grid-cols-2 lg:grid-cols-5` with five helper sentences.                                                                                                                   |
| [x] | 03#35 | High     | done by ui-merchant (`e387cecd`) | Campaign QR hero + a full second management panel. The `rounded-2xl` half was already STALE here: the QR frame was `rounded-lg`.                                                                |
| [x] | 03#36 | Medium   | done by ui-merchant (`e387cecd`) | Offers hub taught the three benefit presets on every visit.                                                                                                                                     |
| [~] | 03#37 | Critical | partial (`071422bb`)             | Chrome unified: one `PrintPreviewNav` (asset-kind row + design row) now serves poster, tent, NFC card and wall plate. The single `/app/qr/print/[kind]/[design]` route is NOT done — see below. RE-TESTED BY RUNNING IT, and the note's residual was half stale. The note said the leftover duplication was "the ~35-line load / `notFound` / render-PNG / error skeleton in the four route files": it was in ONE. Tent, NFC and NFC-square already route through `lib/merchant/print-asset-route.ts`, whose own docblock takes `paramKey` as "`design`, or `template` on posters" — a helper built for a caller that never arrived. I migrated the poster onto it in full and RAN the suite: `not ok 506 - poster route uses protected QR context and the unified render hosts`, because `tests/contracts/qr-a4-poster-templates.test.mjs:67-68` assert the literals `getOwnedQrImageContext` and `renderPosterQrCodePng` INSIDE that file and the helper moves both calls out. Reverted. So the route-collapse half is genuinely contract-blocked — and the blocker's scope is now known to be exactly two identifiers in one file, not the file. SHIPPED what no assertion reaches: the poster route carried its own `PosterRenderError`, a **seventh** copy of the surface 03#41 collapsed to one, byte-identical to the `poster` entry already present in `print-asset-error.tsx` (compared string by string, including `min-h-dvh place-items-center bg-[var(--w-paper)] p-6`, `max-w-md gap-4 edge`, `titleClassName="sm:text-2xl"`, `variant="outline" className="w-fit"` and "Back to QR"), plus a private `firstSearchValue` duplicating the exported one. 114 → 86 lines, no merchant-visible change, and the two pinned identifiers stay put. `deadexports` baseline pruned 375 → 374 because `firstSearchValue` stopped being dead. lint/typecheck/test/build EXIT=0. |
| [x] | 03#39 | Critical | done (`78304258`)                | Four stacked asset lanes (~2,400px at 390px) are now one lane at a time behind an asset-type row.                                                                                               |
| [x] | 03#40 | High     | done (`78304258`)                | The QR workspace hero is now a status strip; the duplicated h2 "Launch your counter QR" is gone.                                                                                                |
| [x] | 03#41 | Low      | done (`c74bfa6a`)                | Six copies of one render-error surface collapse to one `PrintAssetError`.                                                                                                                       |

03#38 was landed by `ui-merchant` and is not this lane's.

## Why 03#37 is only partial

The audit asks for one route, `/app/qr/print/[kind]/[design]`. Three things
block it, and the first is authoritative:

1. `tests/contracts/qr-a4-poster-templates.test.mjs` pins the poster URL shape
   (`/app/qr/poster/${template}?qr=${qrCodeId}&from=${…}`) as a source contract.
   Contracts win over the audit, and weakening that assertion to allow a move is
   exactly the change the brief forbids.

   Re-verified by the root, precisely: the assertion is line 31 and it pins the
   whole template literal, matching `qr-panel-live.tsx:210`. A second pin the
   note missed: `tests/unit/merchant-shell.test.mjs:38-41` asserts
   `isPosterPrintPath` is true for all four `/app/qr/{poster,tent,nfc,nfc-square}/`
   prefixes, so the shell's own chrome suppression is pinned to the current
   paths too. Note for anyone re-checking: `grep 'app/qr/poster'` finds NEITHER
   assertion, because both are regex-escaped as `app\/qr\/poster` — a grep that
   returns nothing is making a claim, and this one is false.

2. Four e2e specs (`poster-print`, `poster-visual`, `tent-print`, `tent-visual`)
   navigate the current paths, and none of them can be run in this lane.
3. Each kind has its own print-tracking server action
   (`app/app/qr/{poster,nfc,nfc-square}/actions.ts` and the tent's silent
   `window.print()`), so one route means one tracking dispatch as well — a
   behaviour change, not a layout one.

What shipped instead is the merchant-visible half: the switcher is now one
component, so changing asset kind or design is one tap from any of the four
previews.

**Re-tested (blockers lane).** The sentence that used to close this paragraph —
"what remains duplicated is the ~35-line load / `notFound` / render-PNG / error
skeleton in the four route files" — was stale. Three of the four already route
through `lib/merchant/print-asset-route.ts`; only `app/app/qr/poster/[template]/page.tsx`
did not, and that helper's docblock already reads `paramKey` as "`design`, or
`template` on posters". It was built for a caller that never arrived.

Migrating the poster onto it in full was tried, not reasoned about, and the
suite answered:

    not ok 506 - poster route uses protected QR context and the unified render hosts
    The input did not match the regular expression /getOwnedQrImageContext/

`tests/contracts/qr-a4-poster-templates.test.mjs:67-68` assert the literals
`getOwnedQrImageContext` and `renderPosterQrCodePng` inside that file, and the
helper moves both calls out — behaviour preserved, literal gone. That is a
reword of an existing assertion, which is the one move this branch does not
make. Reverted.

So the blocker is real and its scope is now exact: **two identifiers in one
file**, not the file and not the route. Everything the assertions do not reach
was shared instead — the poster's private `PosterRenderError` (a seventh copy of
the surface 03#41 collapsed to one, byte-identical to the `poster` entry already
sitting in `print-asset-error.tsx`) and its private `firstSearchValue`. The
route is 114 → 86 lines with no merchant-visible change.

Also worth recording against 03#37: the claim that "the print CTA changes
variant, size and position" is **partly stale**. All four already used
`variant="reward"` with `min-h-11 sm:min-h-9` and the same label; only the
position differed (the poster puts it in a sticky action bar below `lg`).

## Not attempted, and why

- **A modal/focus-trapped confirmation, a sticky publish bar, or any change
  that needs a real browser.** No browser in this lane.
- **Regenerating visual baselines.** `78304258` changes `/app/qr` and
  `/app/launch?tab=qr` above the fold, so those snapshots need a fresh human
  approval. No print sheet was touched, and the preview chrome is `display:none`
  in both the print path and the `@visual` capture path, so the print-asset
  baselines should be unaffected by `071422bb`.

## Bugs found that the audit did not report

1. **`--tent-chrome-offset` was a fixed `6rem` guess feeding a real
   calculation.** `a4-tent.module.css` computes the sheet's fit-to-viewport
   scale from `calc((100dvh - var(--tent-chrome-offset) - 3rem) / 297mm)`, but
   nothing measured the chrome — a header that wrapped at narrow widths made the
   A4 canvas over-scale and overflow. `A4Tent` now measures it with the
   ResizeObserver it already had. (`A4Poster` was already doing this; the tent
   host had copied the shape without the measurement.)
2. **`--nfc-chrome-offset: 6rem` in `a4-nfc-card.module.css` is dead.** It is
   declared on `.page` and referenced nowhere in the repository. Left in place —
   deleting it is a token change and `05-design-system.md` owns that lane — but
   it should go.
