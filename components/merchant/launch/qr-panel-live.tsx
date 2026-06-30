import Link from "next/link"
import {
  ArrowUpRight01Icon,
  LinkSquare02Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { setQrActiveAction } from "@/app/app/qr/actions"
import { Eyebrow, Icon, MonoTag, SectionHeader, STATUS_ICON } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { Button } from "@/components/ui/button"
import {
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

type QrPanelLiveProps = {
  readonly activeCardName: string
  readonly qrCodeId: string
  readonly isActive: boolean
  readonly shareUrl: string
  readonly hasVenueAddress: boolean
  readonly error?: string
  /** Shell to return to after the toggle action, posted as `returnTo`. */
  readonly returnHref: string
}

const POSTER_SURFACE: Record<
  QrPosterTemplateId,
  { readonly card: string; readonly tag: string }
> = {
  editorial: {
    card: "border-l-[3px] border-l-[var(--w-cobalt)] bg-card",
    tag: "text-[var(--w-cobalt)]",
  },
  bold: {
    card: "border-l-[3px] border-l-ink bg-ink text-[var(--w-paper)]",
    tag: "text-[var(--w-paper)]/80",
  },
  ticket: {
    card: "border-l-[3px] border-l-primary bg-card",
    tag: "text-primary",
  },
  northstar: {
    card: "border-l-[3px] border-l-[var(--w-sun)] bg-ink text-[var(--w-paper)]",
    tag: "text-[var(--w-sun)]",
  },
  thermal: {
    card: "border-l-[3px] border-l-[var(--w-ink-soft)] bg-[var(--w-paper-2)]",
    tag: "text-[var(--w-ink-soft)]",
  },
}

export function QrPanelLive({
  activeCardName,
  qrCodeId,
  isActive,
  shareUrl,
  hasVenueAddress,
  error,
  returnHref,
}: QrPanelLiveProps) {
  return (
    <article className="surface-card overflow-hidden">
      <header className="grid gap-4 border-b-2 border-ink bg-[var(--w-paper-2)]/55 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
        <div className="grid min-w-0 gap-2">
          <Eyebrow>Venue QR</Eyebrow>
          <h2 className="text-2xl leading-tight font-extrabold text-balance break-words sm:text-3xl">
            {activeCardName}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Your permanent counter code. Customers scan once to join, collect
            today&apos;s stamp, and unlock a surprise reward.
          </p>
        </div>
        <QrLiveStatus isActive={isActive} />
      </header>

      <div className="grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:divide-x-2 lg:divide-ink">
        <aside className="grid content-start gap-4 border-b-2 border-ink bg-card p-4 sm:p-6 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:border-b-0">
          <QrFrame
            label={`Scanner-safe QR code for ${activeCardName}`}
            className="mx-auto w-full max-w-[260px] shadow-[6px_6px_0_var(--w-shadow-color)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCodeId}`}
              alt={`QR code for ${activeCardName}`}
              width={512}
              height={512}
              className="aspect-square w-full rounded-md bg-white"
            />
          </QrFrame>
          <p className="text-center font-mono text-[10px] leading-5 font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Scan once yourself before the first customer
          </p>
        </aside>

        <div className="grid min-w-0 content-start gap-6 p-4 sm:gap-7 sm:p-6">
          <QrPanelError error={error} />

          {!hasVenueAddress ? (
            <StatusBanner tone="warning" title="Add your venue address before print.">
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

          <section className="grid gap-4" aria-labelledby="qr-share-heading">
            <LaunchStep
              step="01"
              title="Share the link"
              description="Drop this URL anywhere you already talk about loyalty — socials, email footers, or your website."
            />
            <div className="grid gap-3 rounded-lg border-2 border-dashed border-ink/25 bg-[var(--w-paper-2)]/40 p-3 sm:p-4">
              <div className="grid gap-1.5">
                <p id="qr-share-heading" className="eyebrow">
                  Permanent venue link
                </p>
                <p className="font-mono text-xs leading-6 break-all text-foreground sm:text-sm">
                  {shareUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyUrlButton url={shareUrl} />
                <Button asChild variant="outline">
                  <Link href={shareUrl} target="_blank" rel="noreferrer">
                    <Icon icon={LinkSquare02Icon} size={16} />
                    Open link
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <hr className="w-rule" />

          <section className="grid gap-4" aria-labelledby="qr-print-heading">
            <LaunchStep
              step="02"
              title="Print a counter poster"
              description="Pick a layout, open the A4 sheet, and print at 100% scale — no fit-to-page."
            />
            <ul
              id="qr-print-heading"
              className="grid gap-2 sm:grid-cols-2"
            >
              {QR_POSTER_TEMPLATES.map((template) => {
                const surface = POSTER_SURFACE[template.id]

                return (
                  <li key={template.id}>
                    <Link
                      href={`/app/qr/poster/${template.id}?qr=${qrCodeId}&from=${encodeURIComponent(returnHref)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "group grid min-h-[7.5rem] content-between gap-3 rounded-lg border-2 border-ink p-3 shadow-sm transition-[transform,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                        surface.card
                      )}
                    >
                      <span className="grid gap-1">
                        <span className="flex items-center gap-2 text-sm font-extrabold">
                          <Icon
                            icon={PrinterIcon}
                            size={16}
                            className="shrink-0 opacity-80"
                          />
                          {template.name}
                        </span>
                        <span
                          className={cn(
                            "text-xs leading-5",
                            template.id === "bold" || template.id === "northstar"
                              ? "text-[var(--w-paper)]/75"
                              : "text-muted-foreground"
                          )}
                        >
                          {template.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.08em] uppercase",
                          surface.tag
                        )}
                      >
                        Open A4
                        <Icon
                          icon={ArrowUpRight01Icon}
                          size={12}
                          className="transition-transform duration-[var(--w-dur-fast)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                        />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <Disclosure label="How customers use this QR">
            <ol className="grid list-decimal gap-2.5 pl-5 text-sm leading-6 text-muted-foreground">
              <li>New customers scan and join on their phone — no app download.</li>
              <li>
                Returning members scan the same code and tap to collect
                today&apos;s stamp.
              </li>
              <li>
                On the final visit the reward unseals, redeemable from the next
                business day.
              </li>
            </ol>
          </Disclosure>

          <div className="grid gap-3 rounded-lg border-2 border-dashed border-ink/20 bg-secondary/35 p-4">
            <SectionHeader
              eyebrow="Manage"
              title="Pause new scans"
              description="Disable the QR if you need to stop new customers joining. Existing members keep their cards."
            />
            <form action={setQrActiveAction} className="w-fit">
              <input type="hidden" name="qrCodeId" value={qrCodeId} />
              <input
                type="hidden"
                name="nextActive"
                value={isActive ? "false" : "true"}
              />
              <input type="hidden" name="returnTo" value={returnHref} />
              <Button
                type="submit"
                variant={isActive ? "outline" : "reward"}
              >
                {isActive ? "Disable QR" : "Enable QR"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </article>
  )
}

function LaunchStep({
  step,
  title,
  description,
}: {
  readonly step: string
  readonly title: string
  readonly description: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-4">
      <p
        aria-hidden="true"
        className="font-mono text-[10px] font-bold tracking-[0.14em] text-primary uppercase"
      >
        Step {step}
      </p>
      <div className="grid gap-1">
        <h3 className="text-base font-extrabold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function QrLiveStatus({ isActive }: { readonly isActive: boolean }) {
  if (isActive) {
    return (
      <MonoTag tone="leaf" icon={STATUS_ICON.success} className="w-fit">
        Live · accepting scans
      </MonoTag>
    )
  }

  return (
    <MonoTag tone="plain" className="w-fit border-dashed text-muted-foreground">
      Disabled · no new entry
    </MonoTag>
  )
}

function QrPanelError({ error }: { readonly error?: string }) {
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
