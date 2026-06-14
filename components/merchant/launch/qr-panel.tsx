import Link from "next/link"
import { redirect } from "next/navigation"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { PageTitle, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
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
          eyebrow="Dynamic QR"
          title="Create an active card first"
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
          eyebrow="Permanent venue QR"
          title="Generate your venue QR"
          description={
            <>
              This creates one app-controlled customer entry QR for{" "}
              <strong>{activeCard.card_name}</strong>. Add at least one active
              mystery reward before launch.
            </>
          }
          titleClassName="sm:text-3xl"
        />
        <QrErrorBanner error={params.error} />
        {activeRewardPoolItemCount < 1 ? (
          <StatusBanner tone="warning" title="Add a reward before launch.">
            The QR stays blocked until at least one active mystery reward is in
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
          <Button type="submit" disabled={activeRewardPoolItemCount < 1}>
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
  const downloads = [
    {
      href: `/app/qr/download/poster?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/poster?qr=${qrCode.id}`,
      title: "Venue poster PDF",
      description: "A4 print piece for tills, tables, and entrance boards.",
      format: "PDF",
      shape: "aspect-[3/4]",
    },
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
      <ReceiptCard className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <QrFrame label={`Scanner-safe QR code for ${activeCard.card_name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-lg bg-white"
            />
          </QrFrame>
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {qrCode.is_active ? "Active customer entry" : "Disabled"}
          </p>
        </div>

        <div className="grid content-start gap-5">
          <PageTitle
            eyebrow="Permanent venue QR"
            title={activeCard.card_name}
            description="Customers scan this permanent URL to join, collect today's stamp, and unlock a surprise reward. Disabled QR codes remain in history but stop new customer entry."
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
                Venue checks
              </Link>{" "}
              so self-service stamps have the right context.
            </StatusBanner>
          ) : null}

          <div className="grid gap-2 rounded-lg border bg-secondary/50 p-4">
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

          <div className="grid gap-3">
            <p className="text-sm font-bold">Preview and download assets</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {downloads.map((download) => (
                <article
                  key={download.href}
                  className="grid content-between gap-4 rounded-lg border bg-background p-4 shadow-xs"
                >
                  <span className="grid gap-2">
                    <span
                      className={`grid ${download.shape} overflow-hidden rounded-lg border border-border/80 bg-card p-2`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview route is protected by merchant cookies */}
                      <img
                        src={download.previewHref}
                        alt={`${download.title} preview`}
                        className="h-full w-full rounded-lg bg-white object-contain shadow-xs"
                      />
                    </span>
                    <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold text-muted-foreground">
                      {download.format}
                    </span>
                    <span className="text-sm font-extrabold">
                      {download.title}
                    </span>
                    <span className="text-sm leading-6 text-muted-foreground">
                      {download.description}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={download.previewHref} target="_blank">
                        Preview
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={download.href}>Download</Link>
                    </Button>
                  </span>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <p className="text-sm font-bold">Pilot setup checklist</p>
            <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Card active: {activeCard.card_name}</li>
              <li>Active mystery rewards: {activeRewardPoolItemCount}</li>
              <li>
                Venue checks:{" "}
                {location?.address ? "address saved" : "address needed"}
              </li>
              <li>QR status: {qrCode.is_active ? "enabled" : "disabled"}</li>
              <li>Print the counter poster and till card before launch.</li>
              <li>Scan the QR once before the first customer launch.</li>
            </ul>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <p className="text-sm font-bold">Customer flow</p>
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
            <p className="text-sm font-bold text-foreground">
              Target: first scan checked in under 3 minutes.
            </p>
          </div>

          <form action={setQrActiveAction}>
            <input type="hidden" name="qrCodeId" value={qrCode.id} />
            <input
              type="hidden"
              name="nextActive"
              value={qrCode.is_active ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={qrCode.is_active ? "destructive" : "reward"}
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
    error === "Add at least one active mystery reward before launching the QR."
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
