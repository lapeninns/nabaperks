# QR asset render worker

Standalone, always-on service that turns `qr_asset_jobs` rows into high-fidelity
print assets. **Deployed separately from the Vercel app** (Fly.io / Railway /
Render) so Chromium never enters the Next.js serverless bundle.

It is the only place `playwright-core` is used. Nothing under `app/` or `lib/`
imports it, which is why `playwright-core` is **not** a dependency of the main
app and the bundle/typecheck stay clean.

## How it fits

```
Vercel cron  /api/cron/qr-assets  ──POST /drain──▶  this worker
                                                       │
                                   claims queued jobs (status→rendering)
                                                       │
                          Playwright → GET ${PLAYWRIGHT_BASE_URL}/qr/print/<slug>/<id>
                                       (Authorization: Bearer QR_ASSET_WORKER_TOKEN)
                                                       │
                          page.pdf() / page.screenshot()  →  Uint8Array
                                                       │
                       upload → qr-assets/{id}/{kind}/{content_version}.{ext}
                                                       │
                          rpc record_qr_asset_generated  (status→ready)
```

The orchestration (claim → upload → record, ordering, failure handling) lives in
the app repo at `lib/qr/asset-generation-worker.ts` and is unit-tested there.
This service supplies only the Playwright `renderAsset` implementation and a tiny
HTTP `/drain` endpoint, then calls `runQrAssetGenerationWorker({ renderAsset })`.

## Environment

| Var                                         | Used by            | Purpose                                                                                                                 |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | worker             | service-role client (queue + storage + RPC)                                                                             |
| `PLAYWRIGHT_BASE_URL`                       | worker             | deployed app origin to render against (e.g. https://nabaperks.com)                                                      |
| `QR_ASSET_WORKER_TOKEN`                     | worker **and** app | bearer the worker sends; the `/qr/print` route verifies it                                                              |
| `CHROMIUM_WS_ENDPOINT`                      | worker             | optional — if set, connect to a hosted browser (Cloudflare Browser Rendering / Browserless) instead of a local Chromium |
| `QR_ASSET_WORKER_URL`                       | app cron           | this service's base URL, so the cron can POST `/drain`                                                                  |

## Renderer sketch

```js
import { chromium } from "playwright-core"

const WAIT_FOR = '[data-print-ready="true"]'

export async function renderAsset(job) {
  const browser = process.env.CHROMIUM_WS_ENDPOINT
    ? await chromium.connect(process.env.CHROMIUM_WS_ENDPOINT)
    : await chromium.launch({ headless: true })
  try {
    const slug = {
      poster_pdf: "poster",
      till_card_png: "till-card",
      sticker_png: "sticker",
    }[job.asset_kind]
    const page = await browser.newPage({
      extraHTTPHeaders: {
        authorization: `Bearer ${process.env.QR_ASSET_WORKER_TOKEN}`,
      },
    })
    await page.goto(
      `${process.env.PLAYWRIGHT_BASE_URL}/qr/print/${slug}/${job.qr_code_id}`,
      {
        waitUntil: "networkidle",
      }
    )
    await page.waitForSelector(WAIT_FOR)
    await page.evaluate(() => document.fonts.ready)
    if (job.asset_kind === "poster_pdf") {
      return await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      })
    }
    const clip = await page.locator(".qr-print-root").boundingBox()
    return await page.screenshot({ type: "png", clip: clip ?? undefined })
  } finally {
    await browser.close()
  }
}
```

`renderAsset` returns a `Uint8Array`; hand it to `runQrAssetGenerationWorker`.
`document.fonts.ready` + the `[data-print-ready]` sentinel guarantee Bricolage /
Space Mono are loaded before capture (no fallback-font drift).
