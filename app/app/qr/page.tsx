import Link from "next/link"
import { redirect } from "next/navigation"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { PageTitle } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import { getStaffPinSetup } from "@/lib/merchant/staff-pin"
import { getQrSetup } from "@/lib/merchant/qr-code"

type QrPageProps = {
  searchParams: Promise<{
    created?: string
    enabled?: string
    disabled?: string
    error?: string
  }>
}

export default async function QrPage({ searchParams }: QrPageProps) {
  const [
    { merchant, activeCard, activeRewardPoolItemCount, qrCode },
    staffPinSetup,
    params,
  ] = await Promise.all([getQrSetup(), getStaffPinSetup(), searchParams])

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    return (
      <section className="grid gap-4 rounded-3xl border bg-card p-6 shadow-xs">
        <PageTitle
          eyebrow="Dynamic QR"
          title="Create an active card first"
          description="Stampiee needs one active mystery visit card before it can generate a permanent venue QR for customers."
          titleClassName="sm:text-3xl"
        />
        <Button asChild className="w-fit">
          <Link href="/app/card">Go to card builder</Link>
        </Button>
      </section>
    )
  }

  if (!qrCode) {
    return (
      <section className="grid gap-5 rounded-3xl border bg-card p-6 shadow-xs">
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
            <Link href="/app/card" className="font-bold underline underline-offset-4">
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
            <Link href="/app/card">Review card builder</Link>
          </Button>
        </form>
      </section>
    )
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`

  return (
    <div className="grid gap-5">
      {statusMessage(params)}
      <section className="grid gap-6 rounded-3xl border bg-card p-6 shadow-xs lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <QrFrame label={`Scanner-safe QR code for ${activeCard.card_name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-2xl bg-white"
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
            description="Customers scan this permanent URL to collect visit stamps and unlock a surprise reward. Disabled QR codes remain in history but stop new customer entry."
            titleClassName="sm:text-3xl"
          />

          <QrErrorBanner error={params.error} />

          <div className="grid gap-2 rounded-2xl border bg-secondary/50 p-4">
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
            <p className="text-sm font-bold">Downloads</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/app/qr/download/poster?qr=${qrCode.id}`}>
                  Counter poster PDF
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/app/qr/download/till-card?qr=${qrCode.id}`}>
                  Till card PNG
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/app/qr/download/sticker?qr=${qrCode.id}`}>
                  Sticker PNG
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-background p-4">
            <p className="text-sm font-bold">Pilot setup checklist</p>
            <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Card active: {activeCard.card_name}</li>
              <li>Active mystery rewards: {activeRewardPoolItemCount}</li>
              <li>QR status: {qrCode.is_active ? "enabled" : "disabled"}</li>
              <li>
                Staff PIN:{" "}
                {staffPinSetup?.configured ? (
                  "configured"
                ) : (
                  <Link
                    href="/app/settings"
                    className="font-bold text-foreground underline underline-offset-4"
                  >
                    Set staff PIN in Settings
                  </Link>
                )}
              </li>
              <li>Print the counter poster and till card before launch.</li>
              <li>Run the staff flow once before the first customer scan.</li>
            </ul>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-background p-4">
            <p className="text-sm font-bold">Staff training</p>
            <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Customer opens their card and taps Claim stamp.</li>
              <li>Staff checks the purchase and enters the staff PIN.</li>
              <li>
                On the third visit, the reward is revealed and redeemable from
                the next UK business day.
              </li>
            </ol>
            <p className="text-sm font-bold text-foreground">
              Target: train one staff member in under 3 minutes.
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
      </section>
    </div>
  )
}

function statusMessage(params: Awaited<QrPageProps["searchParams"]>) {
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
