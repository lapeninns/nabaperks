# Print-kit export duplex posters and typed folders

Approved 2026-07-26.

## Scope

CLI print-kit export only (`scripts/export-production-poster-pdfs.mjs` + preview
builders). Merchant email PDF kits stay single-page pdf-lib.

## Duplex posters

Eight production designs ship as **four** two-page PDFs (front/back for duplex
print). Pairs contrast style/tone:

| Filename                               | Front   | Back     |
| -------------------------------------- | ------- | -------- |
| `nabaperks-poster-primer-lastcall.pdf` | primer  | lastcall |
| `nabaperks-poster-window-seal.pdf`     | window  | seal     |
| `nabaperks-poster-pinned-tally.pdf`    | pinned  | tally    |
| `nabaperks-poster-receipt-chalk.pdf`   | receipt | chalk    |

Each page is still rendered WYSIWYG from `/dev/poster-preview`; pages are merged
with pdf-lib after Playwright capture.

## Folder layout

```text
output/posters/
  _manifest.json
  {venue-slug}__{qr-id}/
    posters/
    nfc-cards/
    nfc-plates/
    table-tents/
```

## Naming

- `nabaperks-poster-{front}-{back}.pdf`
- `nabaperks-nfc-card-{design}.pdf`
- `nabaperks-nfc-plate-{design}.pdf`
- `nabaperks-tent-{design}.pdf`
