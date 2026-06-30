import Link from "next/link"

import { generateQrCodeAction } from "@/app/app/qr/actions"
import { PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { QrPanelLive } from "@/components/merchant/launch/qr-panel-live"
import { LaunchSaveNextAction } from "@/components/merchant/launch/launch-tab-auto-advance"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import type { LaunchReadiness } from "@/lib/merchant/launch-readiness"
import { QR_LAUNCH_TAB_PATH } from "@/lib/merchant/qr-nav"
import type { QrSetup } from "@/lib/merchant/qr-code"

export type QrPanelParams = {
  created?: string
  enabled?: string
  disabled?: string
  error?: string
}

/**
 * Launch-kit panel. The launch page resolves the QR setup + readiness once and
 * runs the auto-provision side-effect there, then passes the already-resolved
 * data here as props — this panel does NOT re-run the setup pipeline (which
 * previously doubled the round-trips and discarded its own recomputed
 * readiness in steady state).
 */
export async function QrPanel({
  setup,
  readiness,
  params,
  continueHref,
  launchReady = false,
  billingHref,
  returnHref = QR_LAUNCH_TAB_PATH,
}: {
  setup: QrSetup
  readiness: LaunchReadiness
  params: QrPanelParams
  continueHref?: string | null
  launchReady?: boolean
  billingHref?: string | null
  /**
   * Shell the panel is rendered in — posted as a hidden `returnTo` so the QR
   * actions redirect back here instead of the setup chrome. Defaults to the
   * launch tab for the onboarding flow.
   */
  returnHref?: string
}) {
  const { activeCard, qrCode, location } = setup
  const activeRewardPoolItemCount = setup.activeRewardPoolItemCount

  if (!activeCard) {
    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Venue QR"
          title="Build your card first"
          description="Nabaperks needs one active mystery visit card before it can create your permanent venue QR."
          titleClassName="sm:text-3xl"
        />
        <Button asChild className="w-fit">
          <Link href="/app/launch?tab=card">Go to card builder</Link>
        </Button>
      </ReceiptCard>
    )
  }

  if (!qrCode) {
    const canCreateQr = activeRewardPoolItemCount >= 3 && readiness.tabs.venue

    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Venue QR"
          title="Your QR is not live yet"
          description="Create the permanent venue QR once venue, card, and rewards are ready. Billing is the final activation step."
          titleClassName="sm:text-3xl"
        />
        <QrErrorBanner error={params.error} />
        {activeRewardPoolItemCount < 3 ? (
          <StatusBanner tone="warning" title="Add 3 rewards before launch.">
            The QR stays blocked until at least 3 active mystery rewards are in
            the pool.{" "}
            <Link
              href="/app/launch?tab=rewards"
              className="font-bold underline underline-offset-4"
            >
              Add or activate a reward
            </Link>
            .
          </StatusBanner>
        ) : canCreateQr ? (
          <form action={generateQrCodeAction}>
            <input type="hidden" name="returnTo" value={returnHref} />
            <Button type="submit" variant="reward">
              Create QR
            </Button>
          </form>
        ) : readiness.nextStep ? (
          <StatusBanner tone="warning" title="Finish setup to go live.">
            Next up: {readiness.nextStep.actionLabel}.{" "}
            <Link
              href={readiness.nextStep.href}
              className="font-bold underline underline-offset-4"
            >
              Continue setup
            </Link>
            .
          </StatusBanner>
        ) : null}
      </ReceiptCard>
    )
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`

  return (
    <div className="grid min-w-0 gap-3 sm:gap-5">
      {statusMessage(params, launchReady, continueHref, billingHref, returnHref)}
      <QrPanelLive
        activeCardName={activeCard.card_name}
        qrCodeId={qrCode.id}
        isActive={qrCode.is_active}
        shareUrl={shareUrl}
        hasVenueAddress={Boolean(location?.address)}
        error={params.error}
        returnHref={returnHref}
      />
    </div>
  )
}

function statusMessage(
  params: QrPanelParams,
  launchReady: boolean,
  continueHref?: string | null,
  billingHref?: string | null,
  returnHref: string = QR_LAUNCH_TAB_PATH
) {
  const message = params.created
    ? "QR code created."
    : params.enabled
      ? "QR code enabled."
      : params.disabled
        ? "QR code disabled."
        : launchReady
          ? "Your venue QR is live."
          : null

  if (!message) return null

  const nextHref = billingHref ?? continueHref

  return (
    <StatusBanner tone="success" title={message}>
      {nextHref
        ? "Your account is created. Proceed to billing to activate your venue and start accepting stamps."
        : "The permanent resolver and share URL are ready below."}
      {nextHref ? (
        <LaunchSaveNextAction
          nextHref={nextHref}
          nextLabel="billing"
          primaryLabel="Proceed to billing"
          stayHref={returnHref}
        />
      ) : null}
    </StatusBanner>
  )
}

function QrErrorBanner({ error }: { error?: string }) {
  if (!error) return null

  const message =
    error === "Add at least 3 active mystery rewards before launching the QR."
      ? error
      : error === "Unable to update QR"
        ? "Unable to update QR. Check the QR status and try again."
        : "Unable to create QR. Check your card and reward setup, then try again."

  return (
    <StatusBanner tone="error" title="QR action failed.">
      {message}
    </StatusBanner>
  )
}
