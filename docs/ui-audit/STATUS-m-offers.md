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
| [~] | 03#37 | Critical | partial (`071422bb`)             | Chrome unified: one `PrintPreviewNav` (asset-kind row + design row) now serves poster, tent, NFC card and wall plate. The single `/app/qr/print/[kind]/[design]` route is NOT done — see below. |
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
2. Four e2e specs (`poster-print`, `poster-visual`, `tent-print`, `tent-visual`)
   navigate the current paths, and none of them can be run in this lane.
3. Each kind has its own print-tracking server action
   (`app/app/qr/{poster,nfc,nfc-square}/actions.ts` and the tent's silent
   `window.print()`), so one route means one tracking dispatch as well — a
   behaviour change, not a layout one.

What shipped instead is the merchant-visible half: the switcher is now one
component, so changing asset kind or design is one tap from any of the four
previews. What remains duplicated is the ~35-line
load / `notFound` / render-PNG / error skeleton in the four route files, which
no merchant can see.

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
