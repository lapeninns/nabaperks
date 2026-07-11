import Link from "next/link"
import {
  ArrowUpRight01Icon,
  LinkSquare02Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { setQrActiveAction } from "@/app/app/qr/actions"
import {
  Eyebrow,
  Icon,
  MonoTag,
  SectionHeader,
  STATUS_ICON,
} from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { EmailPosterButton } from "@/components/merchant/launch/email-poster-button"
import { QrErrorBanner } from "@/components/merchant/launch/qr-error-banner"
import { Button } from "@/components/ui/button"
import { getActivePromo } from "@/lib/marketing/promo"
import {
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

type QrPanelLiveProps = {
  readonly activeCardName: string
  readonly qrCodeId: string
  readonly isActive: boolean
  readonly billingReady: boolean
  readonly scansAvailable: boolean
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
    card: "border-l-[3px] border-l-cobalt bg-card",
    tag: "text-cobalt",
  },
  bold: {
    card: "border-l-[3px] border-l-ink bg-ink text-paper",
    tag: "text-paper/80",
  },
  ticket: {
    card: "border-l-[3px] border-l-primary bg-card",
    tag: "text-primary",
  },
  northstar: {
    card: "border-l-[3px] border-l-sun bg-ink text-paper",
    tag: "text-sun",
  },
  thermal: {
    card: "border-l-[3px] border-l-ink-soft bg-paper-deep",
    tag: "text-ink-soft",
  },
}

export function QrPanelLive({
  activeCardName,
  qrCodeId,
  isActive,
  billingReady,
  scansAvailable,
  shareUrl,
  hasVenueAddress,
  error,
  returnHref,
}: QrPanelLiveProps) {
  const promo = getActivePromo()

  return (
    <article className="surface-card overflow-hidden">
      <header className="grid gap-4 border-b-2 border-ink bg-paper-deep/55 px-4 py-5 sm:px-6 sm:py-6">
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
        <QrLiveStatus isActive={isActive} scansAvailable={scansAvailable} />
      </header>

      <div className="grid gap-6 p-4 sm:gap-7 sm:p-6">
        <section
          aria-label="Venue QR code"
          className="grid justify-items-center gap-3 border-b-2 border-ink pb-6"
        >
          <QrFrame
            label={`Scanner-safe QR code for ${activeCardName}`}
            className="w-full max-w-[220px] shadow-[6px_6px_0_var(--w-shadow-color)] sm:max-w-[260px]"
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
          <p className="mono-id max-w-sm text-center leading-5 tracking-[0.08em] text-muted-foreground">
            Scan once yourself before the first customer
          </p>
        </section>

        <QrErrorBanner error={error} />

        {!billingReady ? (
          <StatusBanner tone="warning" title="Scans paused — fix billing">
            The poster stays visible, but customers cannot join or collect
            stamps until billing is active.{" "}
            <Link
              href="/app/launch?tab=billing"
              className="font-bold underline underline-offset-4"
            >
              Fix billing
            </Link>
            .
          </StatusBanner>
        ) : null}

        {!hasVenueAddress ? (
          <StatusBanner
            tone="warning"
            title="Add your venue address before print."
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

        {scansAvailable ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="grid gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/40 p-4">
              <p className="eyebrow">Set up at the till</p>
              <h3 className="text-base font-extrabold">
                Put the poster where people pay
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Place a printed poster at the till or bar, where staff can point
                to it. Use the print or email-poster actions below for the copy
                that suits your counter.
              </p>
            </section>
            <section className="grid gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/40 p-4">
              <p className="eyebrow">Brief the team</p>
              <h3 className="text-base font-extrabold">
                Point customers at this QR
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                The customer&apos;s phone joins and collects the stamp. Staff
                only need to point them to the till QR and let the phone do the
                rest. Do not use the merchant reward scanner for first stamps;
                that is only for collecting rewards.
              </p>
            </section>
          </div>
        ) : null}

        <section className="grid gap-4" aria-labelledby="qr-share-heading">
          <LaunchStep
            step="01"
            title="Share the link"
            description="Drop this URL anywhere you already talk about loyalty — socials, email footers, or your website."
          />
          <div className="grid gap-3 rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/40 p-3 sm:p-4">
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
          {/* The section's accessible name is the step heading — never the
              template list (a ul id here concatenated all five tiles). */}
          <LaunchStep
            step="02"
            title="Print a counter poster"
            description="On a phone, email yourself all five poster PDFs. On a computer, open an A4 sheet and print at 100% (no fit-to-page)."
            headingId="qr-print-heading"
          />
          {promo ? (
            <StatusBanner
              tone="info"
              title="Your first printed poster run is included"
            >
              <span className="grid gap-1">
                <span>{promo.perk}</span>
                <span>{promo.claim}</span>
              </span>
            </StatusBanner>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {QR_POSTER_TEMPLATES.map((template) => {
              const surface = POSTER_SURFACE[template.id]

              return (
                <li key={template.id}>
                  <Link
                    href={`/app/qr/poster/${template.id}?qr=${qrCodeId}&from=${encodeURIComponent(returnHref)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "group focus-ring grid min-h-[7.5rem] content-between gap-3 rounded-lg border-2 border-ink p-3 shadow-sm transition-[transform,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
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
                            ? "text-paper/75"
                            : "text-muted-foreground"
                        )}
                      >
                        {template.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mono-id inline-flex items-center gap-1 tracking-[0.08em]",
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
          <EmailPosterButton />
        </section>

        <Disclosure label="How customers use this QR">
          <ol className="grid list-decimal gap-2.5 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              New customers scan and join on their phone — no app download.
            </li>
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
          {!billingReady && !isActive ? (
            <Button asChild className="w-fit">
              <Link href="/app/launch?tab=billing">Fix billing to enable</Link>
            </Button>
          ) : (
            <form action={setQrActiveAction} className="w-fit">
              <input type="hidden" name="qrCodeId" value={qrCodeId} />
              <input
                type="hidden"
                name="nextActive"
                value={isActive ? "false" : "true"}
              />
              <input type="hidden" name="returnTo" value={returnHref} />
              <SubmitButton
                variant={isActive ? "outline" : "reward"}
                pendingLabel={isActive ? "Disabling…" : "Enabling…"}
              >
                {isActive ? "Disable QR" : "Enable QR"}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </article>
  )
}

function LaunchStep({
  step,
  title,
  description,
  headingId,
}: {
  readonly step: string
  readonly title: string
  readonly description: string
  /** Give the h3 an id so a parent section can be aria-labelledby it. */
  readonly headingId?: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-4">
      <p aria-hidden="true" className="mono-id tracking-[0.14em] text-primary">
        Step {step}
      </p>
      <div className="grid gap-1">
        <h3 id={headingId} className="text-base font-extrabold text-foreground">
          {title}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function QrLiveStatus({
  isActive,
  scansAvailable,
}: {
  readonly isActive: boolean
  readonly scansAvailable: boolean
}) {
  if (isActive && scansAvailable) {
    return (
      <MonoTag tone="leaf" icon={STATUS_ICON.success} className="w-fit">
        Live · accepting scans
      </MonoTag>
    )
  }

  if (isActive) {
    return (
      <MonoTag tone="sun" icon={STATUS_ICON.warning} className="w-fit">
        Enabled · scans paused
      </MonoTag>
    )
  }

  return (
    <MonoTag tone="plain" className="w-fit border-dashed text-muted-foreground">
      Disabled · no new entry
    </MonoTag>
  )
}
