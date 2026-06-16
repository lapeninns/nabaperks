import Link from "next/link"
import { redirect } from "next/navigation"
import { Download01Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { RewardSeal } from "@/components/loyalty/reward-seal"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import { getQrSetup } from "@/lib/merchant/qr-code"

export type QrPanelParams = {
  created?: string
  enabled?: string
  disabled?: string
  error?: string
}

export async function QrPanel({ params }: { params: QrPanelParams }) {
  const { merchant, activeCard, activeRewardPoolItemCount, qrCode, location } =
    await getQrSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Step 4 · Print"
          title="Build your card first"
          description="Nabaperks needs one active mystery visit card before it can generate a permanent venue QR for customers."
          titleClassName="sm:text-3xl"
        />
        <Button asChild className="w-fit">
          <Link href="/app/launch?tab=card">Go to card builder</Link>
        </Button>
      </ReceiptCard>
    )
  }

  if (!qrCode) {
    return (
      <ReceiptCard className="grid gap-5">
        <PageTitle
          eyebrow="Step 4 · Print"
          title="Generate your venue QR"
          description={
            <>
              This creates one app-controlled customer entry QR for{" "}
              <strong>{activeCard.card_name}</strong>. Add at least 3 active
              mystery rewards before launch.
            </>
          }
          titleClassName="sm:text-3xl"
        />
        <QrErrorBanner error={params.error} />
        {activeRewardPoolItemCount < 3 ? (
          <StatusBanner tone="warning" title="Add 3 rewards before launch.">
            The QR stays blocked until at least 3 active mystery rewards are in
            the pool.{" "}
            <Link
              href="/app/launch?tab=card"
              className="font-bold underline underline-offset-4"
            >
              Add or activate a reward
            </Link>
            .
          </StatusBanner>
        ) : null}
        <form action={generateQrCodeAction} className="flex flex-wrap gap-2">
          <Button type="submit" disabled={activeRewardPoolItemCount < 3}>
            Generate QR
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/launch?tab=card">Review card builder</Link>
          </Button>
        </form>
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
    <div className="grid gap-5">
      {statusMessage(params)}
      <ReceiptCard className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid h-fit content-start gap-4">
          <QrFrame label={`Scanner-safe QR code for ${activeCard.card_name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-lg bg-white"
            />
          </QrFrame>
          {qrCode.is_active ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-reward bg-reward/10 px-3 py-2">
              <RewardSeal state="redeemed" size="sm" label="QR is live" />
              <span className="font-mono text-xs font-bold tracking-[0.06em] text-reward uppercase">
                Live · accepting scans
              </span>
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground uppercase">
              Disabled · no new customer entry
            </p>
          )}
        </div>

        <div className="grid content-start gap-5">
          <PageTitle
            eyebrow="Step 4 · Print"
            title={activeCard.card_name}
            description="Customers scan this permanent code to join, collect today's stamp, and unlock a surprise reward."
            titleClassName="sm:text-3xl"
          />

          <QrErrorBanner error={params.error} />
          {!location?.address ? (
            <StatusBanner
              tone="warning"
              title="Save venue checks before print."
            >
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

          <div className="grid gap-2 rounded-lg border-2 border-ink bg-secondary/50 p-4">
            <p className="text-sm font-bold">Shareable URL</p>
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

          <div className="grid gap-3 rounded-lg border-2 border-ink bg-background p-4">
            <div className="flex items-center gap-2">
              <Icon icon={PrinterIcon} size={18} />
              <p className="text-sm font-extrabold">Print the counter poster</p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {poster.description} Put it where customers pay, then scan it once
              yourself before the first customer.
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
                    <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold text-muted-foreground">
                      {asset.format}
                    </span>
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
                Existing customers scan the same QR and tap to add today&apos;s
                stamp.
              </li>
              <li>
                On the final visit the reward unseals, redeemable from the next
                business day.
              </li>
            </ol>
          </Disclosure>

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
      </ReceiptCard>
    </div>
  )
}

function statusMessage(params: QrPanelParams) {
  const message = params.created
    ? "QR code created."
    : params.enabled
      ? "QR code enabled."
      : params.disabled
        ? "QR code disabled."
        : null

  if (!message) return null

  return (
    <StatusBanner tone="success" title={message}>
      The permanent <code>/q/{"{qr_id}"}</code> resolver, share URL, and
      downloads remain unchanged.
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
