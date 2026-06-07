import Link from "next/link"
import { redirect } from "next/navigation"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { PageTitle } from "@/components/brand"
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
        {params.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}
        <form action={generateQrCodeAction}>
          <Button type="submit" disabled={activeRewardPoolItemCount < 1}>
            Generate QR
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
          <div className="rounded-3xl border bg-white p-5 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-2xl bg-white"
            />
          </div>
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

          {params.error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {params.error}
            </p>
          ) : null}

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
    <p className="rounded-2xl border border-reward/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
      {message}
    </p>
  )
}
