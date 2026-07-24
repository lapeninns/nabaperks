import Link from "next/link"
import type { ReactNode } from "react"
import {
  LinkSquare02Icon,
  Mail01Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, Icon } from "@/components/brand"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { SwipePosterPicker } from "@/components/merchant/launch/qr-redesign-swipe-picker"
import {
  ChannelButton,
  PosterProof,
  NfcCardLinks,
  NfcSquareLinks,
  TableTentLinks,
  TemplateButton,
  WorkspaceStatus,
  workspaceHref,
  type DistributionChannel,
  type QrWorkspaceStatus,
} from "@/components/merchant/launch/qr-redesign-concept-parts"
import { Button } from "@/components/ui/button"
import {
  getQrPosterUseCase,
  QR_POSTER_PRODUCTION_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"
import type { TableTentDesignId } from "@/lib/qr/tent-templates"

export type { DistributionChannel } from "@/components/merchant/launch/qr-redesign-concept-parts"

export function QrWorkspace({
  activeCardName,
  venueName,
  stampsRequired,
  shareUrl,
  qrImageSrc,
  channel,
  template,
  status,
  navigationBaseHref,
  posterHrefs,
  tentHrefs,
  nfcHrefs,
  nfcSquareHrefs,
  statusAction,
  warnings,
  printNotice,
  printActions,
  posterPickerVariant = "tabs",
}: {
  readonly activeCardName: string
  readonly venueName: string
  readonly stampsRequired: number
  readonly shareUrl: string
  readonly qrImageSrc: string
  readonly channel: DistributionChannel
  readonly template: QrPosterTemplateId
  readonly status: QrWorkspaceStatus
  readonly navigationBaseHref: string
  readonly posterHrefs: Readonly<Record<QrPosterTemplateId, string>>
  readonly tentHrefs: Readonly<Record<TableTentDesignId, string>>
  readonly nfcHrefs: Readonly<Record<NfcCardDesignId, string>>
  readonly nfcSquareHrefs: Readonly<Record<NfcSquareDesignId, string>>
  readonly statusAction?: ReactNode
  readonly warnings?: ReactNode
  readonly printNotice?: ReactNode
  readonly printActions?: ReactNode
  readonly posterPickerVariant?: "tabs" | "swipe"
}) {
  const selectedTemplate =
    QR_POSTER_PRODUCTION_TEMPLATES.find((item) => item.id === template) ??
    QR_POSTER_PRODUCTION_TEMPLATES[0]

  return (
    <article className="grid min-w-0 gap-4 sm:gap-5">
      <section className="surface-card overflow-hidden">
        <header className="grid gap-3 border-b-2 border-ink bg-paper-deep/55 p-4 sm:p-6">
          <Eyebrow>Venue QR</Eyebrow>
          <div className="grid gap-2 sm:flex sm:items-end sm:justify-between">
            <div className="grid gap-1.5">
              <h2 className="text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
                Launch your counter QR
              </h2>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Choose where customers will see it, then put it to work at the
                till.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WorkspaceStatus status={status} />
              {statusAction}
            </div>
          </div>
        </header>

        <div className="grid items-center gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)] lg:gap-8">
          <div className="mx-auto grid w-full max-w-[18rem] gap-2.5">
            <div className="rounded-lg border-2 border-ink bg-white p-4 shadow-[6px_6px_0_var(--w-shadow-color)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- protected merchant QR may come from an authenticated route */}
              <img
                src={qrImageSrc}
                alt={`QR code for ${activeCardName}`}
                width={512}
                height={512}
                className="aspect-square w-full"
              />
            </div>
            <p className="mono-id text-center tracking-[0.08em] text-muted-foreground">
              Permanent venue QR
            </p>
          </div>

          <div className="grid min-w-0 gap-4">
            <div className="grid gap-1">
              <Eyebrow>Ready at {venueName}</Eyebrow>
              <h3 className="text-xl font-extrabold">{activeCardName}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                One permanent QR for joining and collecting stamps. It keeps the
                same address when you change posters.
              </p>
            </div>
            <div className="rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/45 p-3">
              <p className="eyebrow">Permanent venue link</p>
              <p className="mt-1 overflow-hidden font-mono text-xs text-ellipsis whitespace-nowrap sm:text-sm">
                {shareUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="reward">
                <Link href={shareUrl} target="_blank" rel="noreferrer">
                  <Icon icon={LinkSquare02Icon} size={16} />
                  Open customer link
                </Link>
              </Button>
              <CopyUrlButton url={shareUrl} />
            </div>
          </div>
        </div>
      </section>

      {warnings}

      <section
        id="qr-distribution"
        className="surface-card grid scroll-mt-4 gap-5 p-4 sm:p-6"
      >
        <div className="grid gap-1.5">
          <Eyebrow>Put it in front of customers</Eyebrow>
          <h2 className="text-xl font-extrabold sm:text-2xl">
            How will customers find it?
          </h2>
        </div>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="group"
          aria-label="Distribution channel"
        >
          <ChannelButton
            active={channel === "print"}
            icon={PrinterIcon}
            label="Print for the till"
            description="Best for the bar, counter or table."
            href={workspaceHref(navigationBaseHref, "print", template)}
          />
          <ChannelButton
            active={channel === "digital"}
            icon={LinkSquare02Icon}
            label="Share digitally"
            description="Use on social, email or your website."
            href={workspaceHref(navigationBaseHref, "digital", template)}
          />
        </div>

        {channel === "print" ? (
          <div className="grid gap-5 border-t-2 border-ink pt-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
            {posterPickerVariant === "swipe" ? (
              <SwipePosterPicker
                initialTemplate={template}
                qrDataUrl={qrImageSrc}
                venueName={venueName}
                stampsRequired={stampsRequired}
                posterHrefs={posterHrefs}
              />
            ) : (
              <>
                <div id="qr-poster-picker" className="grid scroll-mt-4 gap-3">
                  <div className="grid gap-1">
                    <h3 className="text-lg font-extrabold">
                      Choose a poster style
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Choose the style that best fits where you will display it.
                      You can change it later without changing the QR.
                    </p>
                  </div>
                  <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] lg:grid lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                    {QR_POSTER_PRODUCTION_TEMPLATES.map((item) => (
                      <TemplateButton
                        key={item.id}
                        active={template === item.id}
                        template={item}
                        useCase={getQrPosterUseCase(item.id)}
                        href={workspaceHref(
                          navigationBaseHref,
                          "print",
                          item.id
                        )}
                      />
                    ))}
                  </div>
                </div>

                <PosterProof
                  template={template}
                  templateName={selectedTemplate.name}
                  qrDataUrl={qrImageSrc}
                  venueName={venueName}
                  stampsRequired={stampsRequired}
                  posterHref={posterHrefs[template]}
                />
              </>
            )}
            <TableTentLinks tentHrefs={tentHrefs} />
            <NfcCardLinks nfcHrefs={nfcHrefs} />
            <NfcSquareLinks nfcSquareHrefs={nfcSquareHrefs} />
            {printNotice ? (
              <div className="lg:col-span-2">{printNotice}</div>
            ) : null}
            {printActions ? (
              <div className="lg:col-span-2">{printActions}</div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 border-t-2 border-ink pt-5">
            <div className="grid gap-1">
              <h3 className="text-lg font-extrabold">
                Share your permanent venue link
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Add it anywhere you already speak to regulars. Everyone lands on
                the same join and stamp journey.
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/45 p-4 sm:flex sm:items-center sm:justify-between">
              <p className="min-w-0 overflow-hidden font-mono text-sm text-ellipsis whitespace-nowrap">
                {shareUrl}
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyUrlButton url={shareUrl} />
                <Button asChild variant="outline">
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`${venueName} loyalty QR`)}&body=${encodeURIComponent(`Use this link to join and collect stamps: ${shareUrl}`)}`}
                  >
                    <Icon icon={Mail01Icon} size={16} />
                    Email link
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </article>
  )
}
