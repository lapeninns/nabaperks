import { createHash } from "node:crypto"

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
// Accent inks
// ---------------------------------------------------------------------------

export type PosterAccentKey = "vermillion" | "cobalt" | "leaf" | "sun" | "ink"

export type PosterAccent = {
  key: PosterAccentKey
  accent: string
  accentDeep: string
  accentSoft: string
}

// The five Wet Ink spot inks, each resolved to deterministic light-theme hex so
// the printed asset never depends on the reader's theme (the route renders
// outside the themed tree, and the worker has no theme cookie). Base values are
// the repo's --w-* tokens; the codebase ships no -deep/-soft accent tokens, so
// deep is a darker mix and soft is a ~12% tint over paper, in the house manner.
export const POSTER_ACCENTS: Record<PosterAccentKey, PosterAccent> = {
  vermillion: {
    key: "vermillion",
    accent: "#cf330a",
    accentDeep: "#a62908",
    accentSoft: "#f1dacc",
  },
  cobalt: {
    key: "cobalt",
    accent: "#2b43c8",
    accentDeep: "#2236a0",
    accentSoft: "#dedce2",
  },
  leaf: {
    key: "leaf",
    accent: "#16733c",
    accentDeep: "#125c30",
    accentSoft: "#dbe2d2",
  },
  sun: {
    key: "sun",
    accent: "#f5a623",
    accentDeep: "#c4851c",
    accentSoft: "#f6e8cf",
  },
  ink: {
    key: "ink",
    accent: "#211c16",
    accentDeep: "#1a1612",
    accentSoft: "#dcd7cd",
  },
}

// Every ink is selectable via the explicit ?accent= preview override.
const POSTER_ACCENT_KEYS: PosterAccentKey[] = [
  "vermillion",
  "cobalt",
  "leaf",
  "sun",
  "ink",
]

// The per-merchant rotation excludes sun: as an action accent it tints the
// surfaces gold-on-gold (colliding with the fixed reward seal) and its small
// mono eyebrow fails contrast on cream. Sun stays the fixed reward ink, reached
// only via a deliberate ?accent=sun preview. Four inks → 256 % 4 == 0, so the
// hash is perfectly uniform.
const POSTER_ACCENT_HASH_POOL: PosterAccentKey[] = [
  "vermillion",
  "cobalt",
  "leaf",
  "ink",
]

// Stable per-merchant accent: hash the merchant id and index into the rotation,
// mirroring how stored assets derive identity-stable content versions. A
// read-only ?accent= override (any of the five keys) wins for on-demand preview.
export function resolvePosterAccent(
  merchantId: string,
  override?: string | string[]
): PosterAccent {
  // searchParams can deliver string[] for a repeated key; take the first.
  const raw = Array.isArray(override) ? override[0] : override
  const requested =
    typeof raw === "string" ? raw.trim().toLowerCase() : undefined
  if (requested && isPosterAccentKey(requested)) {
    return POSTER_ACCENTS[requested]
  }
  const digest = createHash("sha256").update(merchantId).digest()
  const index = digest[0] % POSTER_ACCENT_HASH_POOL.length
  return POSTER_ACCENTS[POSTER_ACCENT_HASH_POOL[index]]
}

function isPosterAccentKey(value: string): value is PosterAccentKey {
  return (POSTER_ACCENT_KEYS as string[]).includes(value)
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

// Deterministic light Wet Ink palette so the printed asset never depends on the
// reader's theme. Fonts inherit from the root layout's CSS variables. The accent
// triplet is themed per render via inline custom properties on the root.
const POSTER_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .qr-poster-root, .qr-poster-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-sizing: border-box;
  }
  .qr-poster-root {
    --paper: #f6f1e6;
    --card: #fbf8f1;
    --ink: #211c16;
    --ink-soft: #4f473d;
    --muted: #6b6257;
    --line: rgba(33, 28, 22, 0.18);
    --dashed: rgba(33, 28, 22, 0.22);
    --sun: #f5a623;
    --destructive: #c0301c;
    --poster-accent: #cf330a;
    --poster-accent-deep: #a62908;
    --poster-accent-soft: #f1dacc;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 12mm;
    display: flex;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans), "Bricolage Grotesque", system-ui, sans-serif;
    background-image: radial-gradient(rgba(33, 28, 22, 0.022) 1px, transparent 1px);
    background-size: 5px 5px;
  }
  .poster-card {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: 6px 6px 0 var(--ink);
    overflow: hidden;
  }
  .poster-marquee {
    flex: none;
    height: 34px;
    background: var(--poster-accent-soft);
    border-bottom: 2px solid var(--ink);
    overflow: hidden;
    display: flex;
    align-items: center;
  }
  .poster-marquee span {
    white-space: nowrap;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--ink);
    padding-left: 14px;
  }
  .poster-impressions {
    position: absolute;
    inset: 34px 0 0 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .poster-impression {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 800;
  }
  .poster-impression-a {
    top: 120mm;
    left: -4mm;
    width: 120px;
    height: 120px;
    border: 3px solid var(--poster-accent);
    color: var(--poster-accent);
    font-size: 58px;
    transform: rotate(-14deg);
    opacity: 0.08;
  }
  .poster-impression-b {
    bottom: 18mm;
    right: -3mm;
    width: 104px;
    height: 104px;
    border: 3px solid var(--sun);
    color: var(--sun);
    font-size: 50px;
    transform: rotate(12deg);
    opacity: 0.12;
  }
  .poster-body {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 9mm 13mm 0;
  }
  .poster-masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8mm;
    border-bottom: 2px solid var(--ink);
  }
  .poster-brand { display: flex; align-items: center; gap: 9px; }
  .poster-disc {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--poster-accent);
    border: 2px solid var(--ink);
    display: inline-grid;
    place-items: center;
    color: #fff;
    font-weight: 800;
    font-size: 15px;
    transform: rotate(-6deg);
  }
  .poster-wordmark { font-weight: 800; font-size: 23px; letter-spacing: -0.02em; }
  .poster-badge {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    border: 2px solid var(--ink);
    border-radius: 8px;
    padding: 6px 11px;
    transform: rotate(-2deg);
    background: var(--card);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .poster-headline { padding-top: 8mm; }
  .poster-eyebrow {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--poster-accent-deep);
    margin: 0 0 14px;
  }
  .poster-title {
    font-weight: 800;
    font-size: 62px;
    line-height: 0.94;
    letter-spacing: -0.03em;
    text-wrap: balance;
    margin: 0;
  }
  .poster-title-accent { color: var(--sun); }
  .poster-lede {
    margin: 16px 0 0;
    font-size: 18.5px;
    line-height: 1.45;
    max-width: 31ch;
    color: var(--ink-soft);
  }
  .poster-lede strong { color: var(--ink); font-weight: 700; }
  .poster-hero {
    margin-top: 7mm;
    display: flex;
    align-items: center;
    gap: 11mm;
  }
  .poster-hero-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 7mm;
  }
  .poster-headstart {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    align-self: flex-start;
    background: var(--poster-accent);
    color: #fff;
    border: 2px solid var(--ink);
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .poster-headstart-mark {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.18);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;
    transform: rotate(-7deg);
  }
  .poster-headstart-text { font-size: 17px; font-weight: 700; line-height: 1.16; }
  .poster-progress-label {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 13px;
  }
  .poster-progress-row { display: flex; align-items: center; gap: 11px; }
  .poster-stamp {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .poster-stamp-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .poster-stamp-free {
    background: var(--poster-accent);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    color: #fff;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.02em;
    transform: rotate(-6deg);
  }
  .poster-stamp-tag {
    position: absolute;
    bottom: -19px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 0.14em;
    padding: 3px 8px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .poster-stamp-empty {
    background: var(--card);
    border: 2px dashed rgba(33, 28, 22, 0.45);
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 22px;
    color: #bcae93;
  }
  .poster-stamp-mystery {
    background: var(--sun);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    color: var(--ink);
    font-weight: 800;
    font-size: 30px;
    transform: rotate(-7deg);
  }
  .poster-progress-bar {
    flex: none;
    width: 22px;
    height: 3px;
    background: var(--line);
    border-radius: 2px;
  }
  .poster-steps {
    list-style: none;
    margin: 0;
    padding: 6mm 0 0;
    display: flex;
    flex-direction: column;
    gap: 11px;
    border-top: 2px dashed var(--dashed);
  }
  .poster-steps li { display: flex; align-items: flex-start; gap: 13px; }
  .poster-step-key {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--paper);
    font-weight: 800;
    font-size: 16px;
    display: grid;
    place-items: center;
  }
  .poster-step-copy { display: flex; flex-direction: column; line-height: 1.2; }
  .poster-step-copy strong { font-weight: 700; font-size: 16px; }
  .poster-step-copy span { font-size: 13.5px; color: var(--muted); }
  .poster-accent-text { color: var(--poster-accent-deep); font-weight: 700; }
  .poster-qr {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .poster-qr-title { font-weight: 800; font-size: 19px; line-height: 1.1; margin: 0 0 12px; }
  .poster-qr-stage { position: relative; }
  .poster-seal {
    position: absolute;
    z-index: 5;
    top: -10mm;
    right: -9mm;
    width: 24mm;
    height: 24mm;
    background: var(--sun);
    clip-path: polygon(50% 0%, 60% 14%, 78% 7%, 75% 26%, 93% 24%, 82% 40%, 100% 50%, 82% 60%, 93% 76%, 75% 74%, 78% 93%, 60% 86%, 50% 100%, 40% 86%, 22% 93%, 25% 74%, 7% 76%, 18% 60%, 0% 50%, 18% 40%, 7% 24%, 25% 26%, 22% 7%, 40% 14%);
    display: grid;
    place-items: center;
    filter: drop-shadow(3px 3px 0 var(--ink));
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.05;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .poster-qr-ribbon {
    position: absolute;
    top: -13px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    background: var(--destructive);
    color: #fff;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 6px 13px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
    white-space: nowrap;
  }
  .poster-qr-frame {
    position: relative;
    width: 66mm;
    height: 66mm;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 10px;
    box-shadow: 6px 6px 0 var(--ink);
    padding: 7mm;
    display: grid;
    place-items: center;
  }
  .poster-qr-frame img { width: 100%; height: 100%; display: block; }
  .poster-qr-overlay {
    position: absolute;
    inset: 0;
    background: rgba(246, 241, 230, 0.78);
    border-radius: 10px;
    display: grid;
    place-items: center;
  }
  .poster-qr-overlay span {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--destructive);
    border: 2px solid var(--destructive);
    border-radius: 999px;
    padding: 7px 15px;
    background: var(--card);
    transform: rotate(-5deg);
  }
  .poster-qr-caption { margin: 14px 0 0; font-size: 14px; font-weight: 600; color: var(--ink-soft); }
  .poster-qr-fallback {
    margin: 5px 0 0;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .poster-qr-fallback strong { color: var(--ink); font-weight: 700; }
  .poster-footer {
    flex: none;
    margin-top: auto;
    border-top: 2px dashed var(--dashed);
    padding: 11px 13mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .poster-footer-brand { font-weight: 700; color: var(--ink); }
`

const POSTER_MARQUEE =
  "First stamp free  ✱  No app  ✱  Everyone wins  ✱  Scanned at the counter  ✱  " +
  "First stamp free  ✱  No app  ✱  Everyone wins  ✱"

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
                    <span className="poster-qr-ribbon">
                      Not accepting scans
                    </span>
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
                <p className="poster-qr-caption">
                  Open your camera, point it here
                </p>
                <p className="poster-qr-fallback">
                  No camera? <strong>join.nabaperks.com</strong>
                </p>
              </div>
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
