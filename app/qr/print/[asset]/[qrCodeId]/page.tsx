import {
  CheckmarkBadge04Icon,
  GiftIcon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { CSSProperties } from "react"

import { Icon } from "@/components/brand/icon"
import { deriveVenueInitials } from "@/components/brand/venue-mark"
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

import { resolvePosterAccent, type PosterAccent } from "./poster-accent"
import { POSTER_CSS, POSTER_MARQUEE } from "./poster-styles"

// Lives outside /app/* so the cookie-less render worker is not bounced by the
// merchant-login redirect. Auth is enforced here: a merchant cookie, or the
// worker bearer token. Chromium screenshots / page.pdf() this route.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrPrintRouteParams = {
  params: Promise<{ asset: string; qrCodeId: string }>
  // Read-only preview override; the worker never sets it, so the printed asset
  // uses the stable per-merchant accent. Typed string | string[] because Next
  // delivers an array for a repeated query key.
  searchParams: Promise<{ accent?: string | string[] }>
}

export default async function QrPrintPage({
  params,
  searchParams,
}: QrPrintRouteParams) {
  const { asset, qrCodeId } = await params
  const { accent: accentOverride } = await searchParams
  const assetKind = assetKindFromSlug(asset)
  if (!assetKind) notFound()

  const context = await resolvePrintContext(qrCodeId)
  if (!context) notFound()

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${context.qrCode.qr_id}`
  const qrPng = await renderQrCodePng(shareUrl, 720)
  const qrDataUrl = `data:image/png;base64,${Buffer.from(qrPng).toString("base64")}`
  const accent = resolvePosterAccent(context.merchant.id, accentOverride)

  return (
    <QrPrintDocument
      kind={assetKind}
      context={context}
      qrDataUrl={qrDataUrl}
      accent={accent}
    />
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

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function QrPrintDocument({
  kind,
  context,
  qrDataUrl,
  accent,
}: {
  kind: QrAssetKind
  context: QrPrintContext
  qrDataUrl: string
  accent: PosterAccent
}) {
  // The compact till-card / sticker kinds keep their existing centred layout;
  // the redesigned receipt-card composition is the A4 counter poster.
  if (kind === "till_card_png" || kind === "sticker_png") {
    return (
      <CompactPrintDocument
        kind={kind}
        context={context}
        qrDataUrl={qrDataUrl}
      />
    )
  }
  return (
    <PosterPrintDocument
      kind={kind}
      qrDataUrl={qrDataUrl}
      accent={accent}
      paused={!context.qrCode.is_active}
      venueName={context.merchant.business_name}
      rewardName={context.activeCard.reward_name}
    />
  )
}

// ---------------------------------------------------------------------------
// Counter poster (poster_pdf)
// ---------------------------------------------------------------------------

// The QR column: the venue QR on pure white, the "Scan me" seal, and the paused
// ribbon/overlay. A cohesive unit, lifted out so the poster document stays legible.
function PosterQrColumn({
  qrDataUrl,
  paused,
}: {
  qrDataUrl: string
  paused: boolean
}) {
  return (
    <div className="poster-qr">
      <p className="poster-qr-title">
        Scan to claim
        <br />
        your free stamp
      </p>
      <div className="poster-qr-stage">
        <span className="poster-seal" aria-hidden="true">
          Scan
          <br />
          me
        </span>
        {paused ? (
          <span className="poster-qr-ribbon">Not accepting scans</span>
        ) : null}
        <div className="poster-qr-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Venue loyalty QR code" />
          {paused ? (
            <div className="poster-qr-overlay">
              <span>Paused</span>
            </div>
          ) : null}
        </div>
      </div>
      <p className="poster-qr-caption">Open your camera, point it here</p>
      <p className="poster-qr-fallback">
        No camera? <strong>join.nabaperks.com</strong>
      </p>
    </div>
  )
}

// The counter poster names the venue (masthead + the venue-initial "free" stamp)
// and the reward ("unlock {rewardName}"), mirroring the stored SVG poster in
// lib/qr/assets.ts. The venue-specific QR remains the action. The three-stamp
// composition is fixed and the copy ("three stamps", "Visit twice more", "One of
// three") is coupled to a stamps_required of 3; a non-3 card model would need a
// copy/visual revisit. Functional marks (stamp fill, headstart, mystery seal)
// render through the Hugeicons Icon wrapper per DESIGN.md — the ✱ disc stays the
// wordmark/marquee signature only.
function PosterPrintDocument({
  kind,
  qrDataUrl,
  accent,
  paused,
  venueName,
  rewardName,
}: {
  kind: QrAssetKind
  qrDataUrl: string
  accent: PosterAccent
  paused: boolean
  venueName: string
  rewardName: string
}) {
  // Earned-stamp roundel text, e.g. "The Bell" → "TB"; falls back to a check.
  const venueInitials = deriveVenueInitials(venueName)
  // Themed accent applied as inline custom properties; the markup is identical
  // across inks, only these three variables change.
  const accentStyle = {
    "--poster-accent": accent.accent,
    "--poster-accent-deep": accent.accentDeep,
    "--poster-accent-soft": accent.accentSoft,
  } as CSSProperties

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: POSTER_CSS }} />
      <main
        className={`qr-poster-root kind-${kind}`}
        data-print-ready="true"
        style={accentStyle}
      >
        <div className="poster-card">
          <div className="poster-marquee">
            <span>{POSTER_MARQUEE}</span>
          </div>

          <div className="poster-impressions" aria-hidden="true">
            <span className="poster-impression poster-impression-a">✱</span>
            <span className="poster-impression poster-impression-b">✱</span>
          </div>

          <div className="poster-body">
            <header className="poster-masthead">
              <div className="poster-brand">
                <span className="poster-disc">✱</span>
                <span className="poster-wordmark">nabaperks</span>
              </div>
              <span className="poster-badge">{venueName}</span>
            </header>

            <section className="poster-headline">
              <p className="poster-eyebrow">Free · No app · 20 seconds</p>
              <h1 className="poster-title">
                Everyone wins
                <br />
                <span className="poster-title-accent">something.</span>
              </h1>
              <p className="poster-lede">
                Collect three stamps and unlock <strong>{rewardName}</strong> —
                and <strong>every card wins</strong>. Could be small, could be a
                proper treat.
              </p>
            </section>

            <div className="poster-hero">
              <div className="poster-hero-main">
                <div className="poster-headstart">
                  <span className="poster-headstart-mark">
                    <Icon icon={GiftIcon} size={18} strokeWidth={2.25} />
                  </span>
                  <span className="poster-headstart-text">
                    Your first stamp is on us — just scan to claim it.
                  </span>
                </div>

                <div>
                  <p className="poster-progress-label">
                    One of three · the first is free
                  </p>
                  <div className="poster-progress-row">
                    <span className="poster-stamp-wrap">
                      <span className="poster-stamp poster-stamp-free">
                        {venueInitials || (
                          <Icon
                            icon={CheckmarkBadge04Icon}
                            size={26}
                            strokeWidth={2.25}
                          />
                        )}
                      </span>
                      <span className="poster-stamp-tag">FREE</span>
                    </span>
                    <span className="poster-progress-bar" />
                    <span className="poster-stamp poster-stamp-empty">2</span>
                    <span className="poster-progress-bar" />
                    <span className="poster-stamp poster-stamp-mystery">
                      <Icon
                        icon={HelpCircleIcon}
                        size={30}
                        strokeWidth={2.25}
                      />
                    </span>
                  </div>
                </div>

                <ol className="poster-steps">
                  <li>
                    <span className="poster-step-key">1</span>
                    <span className="poster-step-copy">
                      <strong>Scan &amp; keep your card</strong>
                      <span>
                        20 seconds in your browser. First stamp&rsquo;s on us.
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="poster-step-key">2</span>
                    <span className="poster-step-copy">
                      <strong>Visit twice more</strong>
                      <span>One tap a visit. We keep the count for you.</span>
                    </span>
                  </li>
                  <li>
                    <span className="poster-step-key">3</span>
                    <span className="poster-step-copy">
                      <strong>Break the seal</strong>
                      <span>
                        Three visits and the seal breaks.{" "}
                        <strong className="poster-accent-text">
                          Everyone wins.
                        </strong>
                      </span>
                    </span>
                  </li>
                </ol>
              </div>

              <PosterQrColumn qrDataUrl={qrDataUrl} paused={paused} />
            </div>
          </div>

          <footer className="poster-footer">
            <span className="poster-footer-brand">join.nabaperks.com</span>
            <span>One stamp per business day · Powered by nabaperks</span>
          </footer>
        </div>
      </main>
    </>
  )
}

// ---------------------------------------------------------------------------
// Compact assets (till_card_png, sticker_png) — unchanged centred layout
// ---------------------------------------------------------------------------

const COMPACT_CSS = `
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

function CompactPrintDocument({
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
      <style dangerouslySetInnerHTML={{ __html: COMPACT_CSS }} />
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
