import Link from "next/link"
import { ArrowRight01Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import {
  PresentQrRoot,
  PresentQrTrigger,
} from "@/components/merchant/present-qr"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import {
  buildLaunchReadiness,
  getLaunchBillingReadiness,
} from "@/lib/merchant/launch-readiness"
import { getQrSetup } from "@/lib/merchant/qr-code"

/**
 * Dashboard quick-access QR. Loads the merchant's live join QR and renders it
 * inline on `/app` so the code the customer scans is one glance (and one tap to
 * full screen) away instead of a nav hop to the Poster page. Streamed in its
 * own Suspense boundary so this extra read never blocks the page header or the
 * dashboard metrics.
 */
export async function DashboardQrCard() {
  const setup = await getQrSetup()
  const { qrCode, activeCard, merchant } = setup

  const venueName =
    merchant?.business_name ?? activeCard?.card_name ?? "your venue"

  if (!qrCode) {
    return <DashboardQrSetupPrompt />
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`
  const billing = merchant
    ? await getLaunchBillingReadiness(
        merchant.id,
        merchant.requires_billing !== false
      )
    : undefined
  const readiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode,
    location: setup.location,
    billing,
  })
  const fallbackAction = qrCode.is_active
    ? readiness.nextStep
    : {
        href: "/app/qr",
        actionLabel: "Review QR setup",
      }

  return (
    <DashboardQrCardView
      qrCodeId={qrCode.id}
      venueName={venueName}
      shareUrl={shareUrl}
      isActive={qrCode.is_active}
      scansAvailable={readiness.launchReady}
      actionHref={fallbackAction?.href ?? "/app/qr"}
      actionLabel={fallbackAction?.actionLabel ?? "Review QR setup"}
    />
  )
}

type DashboardQrCardViewProps = {
  readonly qrCodeId: string
  readonly venueName: string
  readonly shareUrl: string
  readonly isActive: boolean
  readonly scansAvailable: boolean
  readonly actionHref: string
  readonly actionLabel: string
}

/**
 * Presentational half — the COUNTER TICKET. Mounted directly by the DB-free
 * `/dev/app-harness` with fixture props (the async loader above hits
 * Supabase).
 *
 * Design intent: this card's job is the counter moment — a customer is
 * standing there, get the code up NOW. So the QR itself is the biggest tap
 * target on the dashboard (the whole ticket opens the full-screen overlay,
 * with Wet Ink press physics), status is a glanceable spot-ink tag rather
 * than body copy, the title is the venue's own name, and the perforated edge
 * says "torn off the till for the counter". The labelled button remains for
 * discoverability; the QR tap is the shortcut.
 */
export function DashboardQrCardView({
  qrCodeId,
  venueName,
  shareUrl,
  isActive,
  scansAvailable,
  actionHref,
  actionLabel,
}: DashboardQrCardViewProps) {
  const thumbnailQrSrc = scansAvailable
    ? `/app/qr/image/${qrCodeId}?w=256`
    : null
  const status = scansAvailable
    ? ({ tone: "leaf", label: "Live" } as const)
    : isActive
      ? ({ tone: "sun", label: "Gated" } as const)
      : ({ tone: "plain", label: "Paused" } as const)
  const unavailableCopy = isActive
    ? {
        label: "Launch gated",
        title: "Finish launch gates",
        body: "Customers cannot join or collect stamps until setup and billing are ready.",
      }
    : {
        label: "QR paused",
        title: "QR paused",
        body: "New customers cannot join until you re-enable it under Poster.",
      }

  const ticket = thumbnailQrSrc ? (
    // The ticket IS the trigger: pressable physics (translate via .pressable,
    // shadow collapsing on the frame) make the QR press into the paper on tap.
    <PresentQrTrigger>
      <button
        type="button"
        className="pressable group/ticket mx-auto grid w-fit justify-items-center gap-2 rounded-lg sm:mx-0"
      >
        <QrFrame
          label={`Venue QR for ${venueName}`}
          className="w-[9.25rem] shadow-[5px_5px_0_var(--w-shadow-color)] transition-shadow duration-[var(--w-dur-press)] ease-[var(--w-ease)] group-active/ticket:shadow-[2px_2px_0_var(--w-shadow-color)] motion-reduce:transition-none"
        >
          {/* 96px, and that is arithmetic rather than taste: the frame is
              9.25rem wide with 2px borders, p-4 and an inner p-2, which leaves
              exactly 6rem of content box. The previous 7.25rem image was 20px
              wider than the box it sat in and overflowed the frame's right
              edge. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies */}
          <img
            src={thumbnailQrSrc}
            alt={`QR code for ${venueName}`}
            width={96}
            height={96}
            className="block aspect-square size-24 shrink-0 object-contain"
          />
        </QrFrame>
        <span className="mono-id text-muted-foreground">
          Tap to show full screen
        </span>
      </button>
    </PresentQrTrigger>
  ) : (
    <div className="mx-auto grid w-fit justify-items-center gap-2 sm:mx-0">
      <QrFrame
        label={`Venue QR for ${venueName}`}
        className="w-[9.25rem] shadow-[5px_5px_0_var(--w-shadow-color)]"
      >
        <div className="mono-id grid aspect-square size-24 place-items-center rounded-md border-2 border-dashed border-ink/25 bg-paper-deep/65 p-3 text-center leading-4 tracking-tag text-muted-foreground">
          {unavailableCopy.label}
        </div>
      </QrFrame>
      <span className="mono-id text-muted-foreground">Not scannable yet</span>
    </div>
  )

  const card = (
    <ReceiptCard
      edge
      className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6"
    >
      {ticket}

      <div className="grid min-w-0 gap-3">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Eyebrow>Counter QR</Eyebrow>
            <MonoTag tone={status.tone}>{status.label}</MonoTag>
          </div>
          <h2 className="text-xl leading-tight font-extrabold text-balance break-words sm:text-2xl">
            {venueName}
          </h2>
        </div>

        {scansAvailable ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Customers scan to join and take today&apos;s stamp.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* One wrap row, not a mixed-width stack: the primary used to be
                  `w-full sm:w-auto` while the two beside it were auto, so on a
                  phone it rendered as a full-width block with two small buttons
                  orphaned underneath. */}
              <PresentQrTrigger>
                <Button type="button">Show full screen</Button>
              </PresentQrTrigger>
              <CopyUrlButton url={shareUrl} />
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/qr" prefetch={false}>
                  <Icon icon={PrinterIcon} size={15} />
                  Poster &amp; print
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/45 p-3">
            <p className="text-sm leading-5 font-extrabold">
              {unavailableCopy.title}
            </p>
            <p className="text-xs leading-5 font-bold text-muted-foreground">
              {unavailableCopy.body}
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={actionHref} prefetch={false}>
                {actionLabel}
                <Icon icon={ArrowRight01Icon} size={14} />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </ReceiptCard>
  )

  // The dialog root only mounts when there is something to present.
  return scansAvailable ? (
    <PresentQrRoot
      qrCodeId={qrCodeId}
      venueName={venueName}
      shareUrl={shareUrl}
    >
      {card}
    </PresentQrRoot>
  ) : (
    card
  )
}

function DashboardQrSetupPrompt() {
  return (
    <ReceiptCard edge className="grid gap-3">
      <div className="grid gap-1.5">
        <Eyebrow>Counter QR</Eyebrow>
        <h2 className="text-xl leading-tight font-extrabold sm:text-2xl">
          Activate your venue QR
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Finish setup to create the permanent QR customers scan to join. Once
          it&apos;s live it shows up here for one-tap access.
        </p>
      </div>
      <Button asChild className="w-fit">
        <Link href="/app/qr" prefetch={false}>
          Go to QR setup
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </Button>
    </ReceiptCard>
  )
}
