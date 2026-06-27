import Link from "next/link"
import { redirect } from "next/navigation"
import { Download01Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { Eyebrow, Icon, MonoTag, PageTitle, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { LaunchSaveNextAction } from "@/components/merchant/launch/launch-tab-auto-advance"
import { Button } from "@/components/ui/button"
import { ensureJoinQrProvisioned } from "@/lib/merchant/ensure-join-qr"
import { getServerEnv } from "@/lib/env/server"
import {
  buildLaunchReadiness,
  getLaunchBillingReadiness,
} from "@/lib/merchant/launch-readiness"
import { getQrSetupFresh } from "@/lib/merchant/qr-code"

export type QrPanelParams = {
  created?: string
  enabled?: string
  disabled?: string
  error?: string
}

export async function QrPanel({
  params,
  continueHref,
  launchReady = false,
  billingHref,
}: {
  params: QrPanelParams
  continueHref?: string | null
  launchReady?: boolean
  billingHref?: string | null
}) {
  let { merchant, activeCard, activeRewardPoolItemCount, qrCode, location } =
    await getQrSetupFresh()
  const billing = merchant
    ? await getLaunchBillingReadiness(merchant.id)
    : undefined
  const readiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount,
    qrCode,
    location,
    billing,
  })

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (
    readiness.tabs.venue &&
    readiness.tabs.card &&
    readiness.tabs.rewards &&
    !readiness.tabs.qr
  ) {
    await ensureJoinQrProvisioned({
      merchantId: merchant.id,
      activeCard,
      activeRewardPoolItemCount,
      venueReady: readiness.tabs.venue,
      qrCode,
    })
    ;({ merchant, activeCard, activeRewardPoolItemCount, qrCode, location } =
      await getQrSetupFresh())
  }

  if (!activeCard) {
    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Launch kit"
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
          eyebrow="Launch kit"
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
  const poster = {
    href: `/app/qr/download/poster?qr=${qrCode.id}`,
    previewHref: `/app/qr/preview/poster?qr=${qrCode.id}`,
    title: "Venue poster PDF",
    description: "A4 print piece for tills, tables, and entrance boards.",
  }
  const moreAssets = [
    {
      href: `/app/qr/download/till-card?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/till-card?qr=${qrCode.id}`,
      title: "Till card PNG",
      description: "Small card to place beside payment.",
      format: "PNG",
      shape: "aspect-[5/3]",
    },
    {
      href: `/app/qr/download/sticker?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/sticker?qr=${qrCode.id}`,
      title: "Sticker PNG",
      description: "Square asset for vinyl stickers and quick reprints.",
      format: "PNG",
      shape: "aspect-square",
    },
  ]

  return (
    <div className="grid min-w-0 gap-3 sm:gap-5">
      {statusMessage(params, launchReady, continueHref, billingHref)}
      <ReceiptCard className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid h-fit content-start gap-3">
          <QrFrame label={`Scanner-safe QR code for ${activeCard.card_name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-lg bg-white"
            />
          </QrFrame>
          {qrCode.is_active ? (
            <p className="flex items-center gap-2.5 font-mono text-xs font-bold tracking-[0.06em] text-reward uppercase">
              <RewardSeal state="redeemed" size="sm" label="QR is live" />
              Live · accepting scans
            </p>
          ) : (
            <p className="font-mono text-xs text-muted-foreground uppercase">
              Disabled · no new customer entry
            </p>
          )}
        </div>

        <div className="grid content-start gap-4">
          <PageTitle
            eyebrow="Launch kit"
            title={activeCard.card_name}
            description="Customers scan this permanent code to join, collect today's stamp, and unlock a surprise reward."
            titleClassName="sm:text-3xl"
          />

          <QrErrorBanner error={params.error} />
          {!location?.address ? (
            <StatusBanner tone="warning" title="Save venue checks before print.">
              Add the venue address from{" "}
              <Link
                href="/app/launch?tab=venue"
                className="font-bold underline underline-offset-4"
              >
                your venue step
              </Link>{" "}
              so stamps are tied to the right venue.
            </StatusBanner>
          ) : null}

          <div className="grid gap-0 rounded-lg border-2 border-ink bg-background p-4 sm:p-5">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Icon icon={PrinterIcon} size={18} />
                <p className="text-sm font-extrabold">Print it</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {poster.description} Put it where customers pay.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={poster.href}>
                    <Icon icon={Download01Icon} size={16} />
                    Download poster
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={poster.previewHref} target="_blank">
                    Preview poster
                  </Link>
                </Button>
              </div>
            </div>

            <hr className="w-rule" />

            <div className="grid gap-3">
              <p className="text-sm font-extrabold">Scan it once yourself</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Scan the poster once before the first customer to check it
                resolves.
              </p>
              <div className="grid gap-2">
                <Eyebrow>Share link</Eyebrow>
                <p className="font-mono text-sm break-all text-muted-foreground">
                  {shareUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <CopyUrlButton url={shareUrl} />
                  <Button asChild variant="outline">
                    <Link href={shareUrl} target="_blank">
                      Open URL
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <Disclosure label="More print assets">
              <p className="text-xs leading-5 text-muted-foreground">
                Same QR, smaller formats for tills and windows.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {moreAssets.map((asset) => (
                  <article
                    key={asset.href}
                    className="grid content-between gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-xs"
                  >
                    <span className="grid gap-2">
                      <span
                        className={`grid ${asset.shape} overflow-hidden rounded-lg border border-border/80 bg-card p-2`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- preview route is protected by merchant cookies */}
                        <img
                          src={asset.previewHref}
                          alt={`${asset.title} preview`}
                          className="h-full w-full rounded-lg bg-white object-contain shadow-xs"
                        />
                      </span>
                      <MonoTag tone="plain" className="w-fit">
                        {asset.format}
                      </MonoTag>
                      <span className="text-sm font-extrabold">
                        {asset.title}
                      </span>
                      <span className="text-sm leading-6 text-muted-foreground">
                        {asset.description}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={asset.previewHref} target="_blank">
                          Preview
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={asset.href}>Download</Link>
                      </Button>
                    </span>
                  </article>
                ))}
              </div>
            </Disclosure>

            <Disclosure label="How customers use this">
              <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>New customers scan the QR and join with their phone.</li>
                <li>
                  Existing customers scan the same QR and tap to add
                  today&apos;s stamp.
                </li>
                <li>
                  On the final visit the reward unseals, redeemable from the
                  next business day.
                </li>
              </ol>
            </Disclosure>
          </div>

          <div className="grid gap-0">
            <hr className="w-rule" />
            <form action={setQrActiveAction}>
              <input type="hidden" name="qrCodeId" value={qrCode.id} />
              <input
                type="hidden"
                name="nextActive"
                value={qrCode.is_active ? "false" : "true"}
              />
              <Button
                type="submit"
                variant={qrCode.is_active ? "outline" : "reward"}
              >
                {qrCode.is_active ? "Disable QR" : "Enable QR"}
              </Button>
            </form>
          </div>
        </div>
      </ReceiptCard>
    </div>
  )
}

function statusMessage(
  params: QrPanelParams,
  launchReady: boolean,
  continueHref?: string | null,
  billingHref?: string | null
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
        : "The permanent resolver, share URL, and downloads are ready below."}
      {nextHref ? (
        <LaunchSaveNextAction
          nextHref={nextHref}
          nextLabel="billing"
          primaryLabel="Proceed to billing"
          stayHref="/app/launch?tab=qr"
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
