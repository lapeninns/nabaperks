import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import {
  getQrAssetContextForWorker,
  verifyQrAssetWorkerToken,
  type QrPrintContext,
} from "@/lib/qr/asset-store"
import {
  assetKindFromSlug,
  renderQrCodePng,
  type QrAssetKind,
} from "@/lib/qr/assets"

// Lives outside /app/* so the cookie-less render worker is not bounced by the
// merchant-login redirect. Auth is enforced here: a merchant cookie, or the
// worker bearer token. Chromium screenshots / page.pdf() this route.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrPrintRouteParams = {
  params: Promise<{ asset: string; qrCodeId: string }>
}

export default async function QrPrintPage({ params }: QrPrintRouteParams) {
  const { asset, qrCodeId } = await params
  const assetKind = assetKindFromSlug(asset)
  if (!assetKind) notFound()

  const context = await resolvePrintContext(qrCodeId)
  if (!context) notFound()

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${context.qrCode.qr_id}`
  const qrPng = await renderQrCodePng(shareUrl, 720)
  const qrDataUrl = `data:image/png;base64,${Buffer.from(qrPng).toString("base64")}`

  return (
    <QrPrintDocument kind={assetKind} context={context} qrDataUrl={qrDataUrl} />
  )
}

async function resolvePrintContext(
  qrCodeId: string
): Promise<QrPrintContext | null> {
  const headerList = await headers()
  const authorization = headerList.get("authorization")
  const token = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null

  if (verifyQrAssetWorkerToken(token)) {
    return getQrAssetContextForWorker(qrCodeId)
  }

  const owned = await getOwnedQrAssetContext(qrCodeId)
  if (!owned) return null
  return {
    merchant: {
      id: owned.merchant.id,
      business_name: owned.merchant.business_name,
    },
    location: { id: owned.location.id, name: owned.location.name },
    activeCard: {
      id: owned.activeCard.id,
      card_name: owned.activeCard.card_name,
      reward_name: owned.activeCard.reward_name,
      stamps_required: owned.activeCard.stamps_required,
    },
    qrCode: {
      id: owned.qrCode.id,
      qr_id: owned.qrCode.qr_id,
      is_active: owned.qrCode.is_active,
    },
  }
}

// Deterministic light Wet Ink palette so the printed asset never depends on the
// reader's theme. Fonts inherit from the root layout's CSS variables.
const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .qr-print-root, .qr-print-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-sizing: border-box;
  }
  .qr-print-root {
    --paper: #f6f1e6;
    --card: #fbf8f1;
    --ink: #211c16;
    --ink-soft: #4f473d;
    --line: rgba(33, 28, 22, 0.18);
    --accent: #cf330a;
    --leaf: #16733c;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 22mm 18mm;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans), "Bricolage Grotesque", system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10mm;
  }
  .qr-print-root.kind-till_card_png { width: 148mm; min-height: 105mm; padding: 12mm; }
  .qr-print-root.kind-sticker_png { width: 105mm; min-height: 105mm; padding: 10mm; }
  .qr-eyebrow {
    font-family: var(--font-mono), ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 11pt;
    color: var(--accent);
  }
  .qr-venue { font-size: 34pt; font-weight: 800; line-height: 1.05; margin: 0; }
  .qr-tagline { font-size: 15pt; color: var(--ink-soft); margin: 0; }
  .qr-frame {
    background: #fff;
    border: 3px solid var(--ink);
    border-radius: 18px;
    padding: 8mm;
    display: inline-flex;
  }
  .qr-frame img { width: 78mm; height: 78mm; display: block; }
  .kind-till_card_png .qr-frame img, .kind-sticker_png .qr-frame img {
    width: 52mm; height: 52mm;
  }
  .qr-reward {
    background: var(--card);
    border: 2px solid var(--line);
    border-radius: 14px;
    padding: 6mm 8mm;
    font-size: 16pt;
    font-weight: 700;
    max-width: 150mm;
  }
  .qr-meta { font-size: 12pt; color: var(--ink-soft); margin: 0; }
  .qr-status {
    font-family: var(--font-mono), ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 10pt;
    color: var(--leaf);
  }
  .qr-status[data-active="false"] { color: var(--accent); }
  .qr-foot {
    margin-top: auto;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 9pt;
    color: var(--ink-soft);
    letter-spacing: 0.08em;
  }
`

function QrPrintDocument({
  kind,
  context,
  qrDataUrl,
}: {
  kind: QrAssetKind
  context: QrPrintContext
  qrDataUrl: string
}) {
  const statusLabel = context.qrCode.is_active
    ? "Open for new scans"
    : "Not accepting scans right now"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <main className={`qr-print-root kind-${kind}`} data-print-ready="true">
        <p className="qr-eyebrow">Scan · stamp · reveal</p>
        <h1 className="qr-venue">{context.merchant.business_name}</h1>
        <p className="qr-tagline">No app needed — point your camera here</p>

        <div className="qr-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Venue loyalty QR code" />
        </div>

        <p className="qr-reward">
          Collect visit stamps to unlock {context.activeCard.reward_name}
        </p>
        <p className="qr-meta">
          {context.activeCard.card_name} · {context.location.name}
        </p>
        <p className="qr-status" data-active={String(context.qrCode.is_active)}>
          {statusLabel}
        </p>

        <p className="qr-foot">Powered by Nabaperks · print at 100%</p>
      </main>
    </>
  )
}
