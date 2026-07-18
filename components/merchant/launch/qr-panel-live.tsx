import Link from "next/link"

import { setQrActiveAction } from "@/app/app/qr/actions"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { EmailPosterButton } from "@/components/merchant/launch/email-poster-button"
import { QrErrorBanner } from "@/components/merchant/launch/qr-error-banner"
import { QrWorkspace } from "@/components/merchant/launch/qr-redesign-concept"
import {
  buildPosterHrefs,
  buildTentHrefs,
  resolveDistributionChannel,
  resolveQrPosterTemplate,
} from "@/components/merchant/launch/qr-redesign-concept-parts"
import { Button } from "@/components/ui/button"
import { getActivePromo } from "@/lib/marketing/promo"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"
import type { TableTentDesignId } from "@/lib/qr/tent-templates"

type QrPanelLiveProps = {
  readonly activeCardName: string
  readonly stampsRequired: number
  readonly venueName: string
  readonly qrCodeId: string
  readonly isActive: boolean
  readonly billingReady: boolean
  readonly scansAvailable: boolean
  readonly shareUrl: string
  readonly hasVenueAddress: boolean
  readonly error?: string
  readonly returnHref: string
  readonly workspaceHref?: string
  readonly channel?: string
  readonly poster?: string
}

export function QrPanelLive({
  activeCardName,
  stampsRequired,
  venueName,
  qrCodeId,
  isActive,
  billingReady,
  scansAvailable,
  shareUrl,
  hasVenueAddress,
  error,
  returnHref,
  workspaceHref,
  channel,
  poster,
}: QrPanelLiveProps) {
  const selectedChannel = resolveDistributionChannel(channel)
  const selectedPoster = resolveQrPosterTemplate(poster)
  const promo = getActivePromo()
  const posterHrefs = buildPosterHrefs((template) =>
    productionPosterHref(template, qrCodeId, returnHref)
  )
  const tentHrefs = buildTentHrefs((design) =>
    productionTentHref(design, qrCodeId, returnHref)
  )

  return (
    <QrWorkspace
      activeCardName={activeCardName}
      stampsRequired={stampsRequired}
      venueName={venueName}
      shareUrl={shareUrl}
      qrImageSrc={`/app/qr/image/${qrCodeId}`}
      channel={selectedChannel}
      template={selectedPoster}
      status={scansAvailable ? "live" : isActive ? "paused" : "disabled"}
      navigationBaseHref={workspaceHref ?? returnHref}
      posterHrefs={posterHrefs}
      tentHrefs={tentHrefs}
      statusAction={
        <QrStatusAction
          qrCodeId={qrCodeId}
          isActive={isActive}
          billingReady={billingReady}
          returnHref={returnHref}
        />
      }
      warnings={
        <QrWorkspaceWarnings
          billingReady={billingReady}
          showAddressWarning={selectedChannel === "print" && !hasVenueAddress}
          error={error}
        />
      }
      printNotice={
        promo ? (
          <StatusBanner
            tone="info"
            title="Your first printed poster run is included"
          >
            <span className="grid gap-1">
              <span>{promo.perk}</span>
              <span>{promo.claim}</span>
            </span>
          </StatusBanner>
        ) : null
      }
      printActions={<EmailPosterButton />}
    />
  )
}

function QrWorkspaceWarnings({
  billingReady,
  showAddressWarning,
  error,
}: {
  readonly billingReady: boolean
  readonly showAddressWarning: boolean
  readonly error?: string
}) {
  if (billingReady && !showAddressWarning && !error) return null

  return (
    <div className="grid gap-3">
      <QrErrorBanner error={error} />
      {!billingReady ? (
        <StatusBanner tone="warning" title="Scans paused — fix billing">
          Customers cannot join or collect stamps until billing is active.{" "}
          <Link
            href="/app/launch?tab=billing"
            className="font-bold underline underline-offset-4"
          >
            Fix billing
          </Link>
          .
        </StatusBanner>
      ) : null}
      {showAddressWarning ? (
        <StatusBanner
          tone="warning"
          title="Add your venue address before print"
        >
          Stamps need the right location.{" "}
          <Link
            href="/app/launch?tab=venue"
            className="font-bold underline underline-offset-4"
          >
            Complete venue step
          </Link>
          .
        </StatusBanner>
      ) : null}
    </div>
  )
}

function QrStatusAction({
  qrCodeId,
  isActive,
  billingReady,
  returnHref,
}: {
  readonly qrCodeId: string
  readonly isActive: boolean
  readonly billingReady: boolean
  readonly returnHref: string
}) {
  if (!billingReady && !isActive) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/app/launch?tab=billing">Fix billing before resuming</Link>
      </Button>
    )
  }

  return (
    <form action={setQrActiveAction}>
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <input
        type="hidden"
        name="nextActive"
        value={isActive ? "false" : "true"}
      />
      <input type="hidden" name="returnTo" value={returnHref} />
      <SubmitButton
        size="sm"
        variant="outline"
        pendingLabel={isActive ? "Pausing…" : "Resuming…"}
      >
        {isActive ? "Pause customer scans" : "Resume customer scans"}
      </SubmitButton>
    </form>
  )
}

function productionPosterHref(
  template: QrPosterTemplateId,
  qrCodeId: string,
  returnHref: string
) {
  return `/app/qr/poster/${template}?qr=${qrCodeId}&from=${encodeURIComponent(returnHref)}`
}

function productionTentHref(
  design: TableTentDesignId,
  qrCodeId: string,
  returnHref: string
) {
  return `/app/qr/tent/${design}?qr=${qrCodeId}&from=${encodeURIComponent(returnHref)}`
}
