import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { PresentQrButton } from "@/components/merchant/present-qr"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
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

  return (
    <DashboardQrCardView
      qrCodeId={qrCode.id}
      venueName={venueName}
      shareUrl={shareUrl}
      isActive={qrCode.is_active}
    />
  )
}

type DashboardQrCardViewProps = {
  readonly qrCodeId: string
  readonly venueName: string
  readonly shareUrl: string
  readonly isActive: boolean
}

/**
 * Presentational half — mounted directly by the DB-free `/dev/app-harness`
 * with fixture props (the async loader above hits Supabase).
 */
export function DashboardQrCardView({
  qrCodeId,
  venueName,
  shareUrl,
  isActive,
}: DashboardQrCardViewProps) {
  const thumbnailQrSrc = `/app/qr/image/${qrCodeId}?w=256`

  return (
    <ReceiptCard className="grid gap-4 sm:grid-cols-[9.25rem_minmax(0,1fr)] sm:items-start sm:gap-6">
      <QrFrame
        label={`Venue QR for ${venueName}`}
        className="mx-auto min-h-0 min-w-0 w-[9.25rem] max-w-full shrink-0 overflow-hidden shadow-[5px_5px_0_var(--w-shadow-color)] sm:mx-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies */}
        <img
          src={thumbnailQrSrc}
          alt={`QR code for ${venueName}`}
          width={148}
          height={148}
          className="block aspect-square size-[7.25rem] max-w-full object-contain"
        />
      </QrFrame>

      <div className="grid min-w-0 gap-3">
        <div className="grid gap-1.5">
          <Eyebrow>Counter QR</Eyebrow>
          <h2 className="text-xl leading-tight font-extrabold text-balance sm:text-2xl">
            Show a customer, instantly
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            One tap makes it full screen — customers scan to join and collect
            today&apos;s stamp. No app to download.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PresentQrButton
            qrCodeId={qrCodeId}
            venueName={venueName}
            shareUrl={shareUrl}
          />
          <CopyUrlButton url={shareUrl} />
        </div>

        {!isActive ? (
          <p className="text-xs leading-5 font-bold text-muted-foreground">
            Paused — new customers can&apos;t join until you re-enable it under
            Poster.
          </p>
        ) : null}
      </div>
    </ReceiptCard>
  )
}

function DashboardQrSetupPrompt() {
  return (
    <ReceiptCard className="grid gap-3">
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
