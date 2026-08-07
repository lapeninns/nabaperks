import Link from "next/link"
import {
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { Icon, IconRoundel, MonoTag } from "@/components/brand"
import { PosterThumbnail } from "@/components/merchant/qr-poster/poster-thumbnail"
import { Button } from "@/components/ui/button"
import {
  QR_POSTER_PRODUCTION_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import {
  TENT_PRODUCTION_DESIGNS,
  type TableTentDesignId,
} from "@/lib/qr/tent-templates"
import {
  NFC_CARD_PRODUCTION_DESIGNS,
  type NfcCardDesignId,
} from "@/lib/qr/nfc-card-templates"
import {
  NFC_SQUARE_PRODUCTION_DESIGNS,
  type NfcSquareDesignId,
} from "@/lib/qr/nfc-square-templates"
import { cn } from "@/lib/utils"

export type DistributionChannel = "print" | "digital"
export type QrWorkspaceStatus = "live" | "paused" | "disabled"

export function ChannelButton({
  active,
  icon,
  label,
  description,
  href,
}: {
  readonly active: boolean
  readonly icon: typeof PrinterIcon
  readonly label: string
  readonly description: string
  readonly href: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring grid min-h-24 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border-2 p-4 text-left transition-[transform,box-shadow,background-color] motion-reduce:transition-none",
        active
          ? "-translate-y-px border-ink bg-secondary shadow-md"
          : "border-ink/30 bg-card hover:border-ink hover:shadow-sm"
      )}
    >
      <IconRoundel icon={icon} size="md" tone="card" className="shadow-sm" />
      <span className="grid gap-1">
        <span className="font-extrabold">{label}</span>
        <span className="text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  )
}

export function TemplateButton({
  active,
  template,
  useCase,
  href,
}: {
  readonly active: boolean
  readonly template: { readonly id: QrPosterTemplateId; readonly name: string }
  readonly useCase: string
  readonly href: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring grid min-h-14 min-w-40 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-[transform,box-shadow,background-color] motion-reduce:transition-none lg:min-w-0",
        active
          ? "-translate-y-px border-ink bg-secondary shadow-md"
          : "border-ink/25 bg-card hover:border-ink hover:shadow-sm"
      )}
    >
      <IconRoundel size="sm" tone="card" className="size-7">
        {active ? (
          <Icon icon={CheckmarkCircle02Icon} size={16} className="text-leaf" />
        ) : (
          <span className="font-mono text-xs font-bold">
            {template.name.slice(0, 1)}
          </span>
        )}
      </IconRoundel>
      <span className="grid min-w-0 gap-0.5">
        <span className="font-extrabold">{template.name}</span>
        <span className="text-xs leading-5 text-muted-foreground">
          {useCase}
        </span>
      </span>
    </Link>
  )
}

export function PosterProof({
  template,
  templateName,
  qrDataUrl,
  venueName,
  stampsRequired,
  posterHref,
}: {
  readonly template: QrPosterTemplateId
  readonly templateName: string
  readonly qrDataUrl: string
  readonly venueName: string
  readonly stampsRequired: number
  readonly posterHref: string
}) {
  return (
    <aside className="grid content-start gap-3 rounded-lg border-2 border-ink bg-paper-deep p-3 shadow-[5px_5px_0_var(--w-shadow-color)] sm:p-4">
      <div className="mx-auto w-full max-w-60 rounded-md border-2 border-ink bg-paper p-1.5 lg:max-w-72">
        <PosterThumbnail
          previewLabel={`${templateName} poster preview`}
          template={template}
          qrDataUrl={qrDataUrl}
          merchantName={venueName}
          stampsRequired={stampsRequired}
        />
      </div>
      <div className="grid gap-1">
        <p className="font-extrabold">{templateName} poster</p>
        <p className="text-xs leading-5 text-muted-foreground">
          See how this design looks for your venue, then open it to print or
          save.
        </p>
      </div>
      <Button asChild variant="reward" className="w-full">
        <Link href={posterHref} target="_blank" rel="noreferrer">
          Open poster
          <Icon icon={ArrowUpRight01Icon} size={15} />
        </Link>
      </Button>
    </aside>
  )
}

export function buildTentHrefs(
  resolveHref: (id: TableTentDesignId) => string
): Readonly<Record<TableTentDesignId, string>> {
  return Object.fromEntries(
    TENT_PRODUCTION_DESIGNS.map((item) => [item.id, resolveHref(item.id)])
  ) as Readonly<Record<TableTentDesignId, string>>
}

export function buildNfcCardHrefs(
  resolveHref: (id: NfcCardDesignId) => string
): Readonly<Record<NfcCardDesignId, string>> {
  return Object.fromEntries(
    NFC_CARD_PRODUCTION_DESIGNS.map((item) => [item.id, resolveHref(item.id)])
  ) as Readonly<Record<NfcCardDesignId, string>>
}

export function buildNfcSquareHrefs(
  resolveHref: (id: NfcSquareDesignId) => string
): Readonly<Record<NfcSquareDesignId, string>> {
  return Object.fromEntries(
    NFC_SQUARE_PRODUCTION_DESIGNS.map((item) => [item.id, resolveHref(item.id)])
  ) as Readonly<Record<NfcSquareDesignId, string>>
}

/**
 * The table-tent lane of the print channel.
 */
export function TableTentLinks({
  tentHrefs,
}: {
  readonly tentHrefs: Readonly<Record<TableTentDesignId, string>>
}) {
  return (
    <section id="qr-tent-picker" className="grid min-w-0 scroll-mt-4 gap-3">
      <div className="grid gap-1">
        <h3 className="text-lg font-extrabold">Add table tents</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Place these on tables and bar tops so guests can scan your venue QR
          from either side.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TENT_PRODUCTION_DESIGNS.map((tent) => (
          <Link
            key={tent.id}
            href={tentHrefs[tent.id]}
            target="_blank"
            rel="noreferrer"
            className="focus-ring grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border-2 border-ink/25 bg-card px-3 py-2.5 transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-ink hover:shadow-sm motion-reduce:transition-none"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-extrabold">{tent.name}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {tent.useCase}
              </span>
            </span>
            <Icon
              icon={ArrowUpRight01Icon}
              size={16}
              className="text-muted-foreground"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * The NFC card lane — reusable tap-and-scan cards.
 */
export function NfcCardLinks({
  nfcHrefs,
}: {
  readonly nfcHrefs: Readonly<Record<NfcCardDesignId, string>>
}) {
  return (
    <section id="qr-nfc-picker" className="grid min-w-0 scroll-mt-4 gap-3">
      <div className="grid gap-1">
        <h3 className="text-lg font-extrabold">Add NFC cards</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Reusable cards for the counter and till. Choose a loyalty join card or
          a Google Review card, each with tap and scan.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {NFC_CARD_PRODUCTION_DESIGNS.map((card) => (
          <Link
            key={card.id}
            href={nfcHrefs[card.id]}
            target="_blank"
            rel="noreferrer"
            className="focus-ring grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border-2 border-ink/25 bg-card px-3 py-2.5 transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-ink hover:shadow-sm motion-reduce:transition-none"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-extrabold">{card.name}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {card.useCase}
              </span>
            </span>
            <Icon
              icon={ArrowUpRight01Icon}
              size={16}
              className="text-muted-foreground"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * The wall NFC lane — a fixed tap-and-scan point.
 */
export function NfcSquareLinks({
  nfcSquareHrefs,
}: {
  readonly nfcSquareHrefs: Readonly<Record<NfcSquareDesignId, string>>
}) {
  return (
    <section
      id="qr-nfc-square-picker"
      className="grid min-w-0 scroll-mt-4 gap-3"
    >
      <div className="grid gap-1">
        <h3 className="text-lg font-extrabold">Add wall NFC plates</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Add a fixed loyalty or Google Review tap-and-scan point to a wall,
          counter or till.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {NFC_SQUARE_PRODUCTION_DESIGNS.map((card) => (
          <Link
            key={card.id}
            href={nfcSquareHrefs[card.id]}
            target="_blank"
            rel="noreferrer"
            className="focus-ring grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border-2 border-ink/25 bg-card px-3 py-2.5 transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-ink hover:shadow-sm motion-reduce:transition-none"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-extrabold">{card.name}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {card.useCase}
              </span>
            </span>
            <Icon
              icon={ArrowUpRight01Icon}
              size={16}
              className="text-muted-foreground"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}

export function WorkspaceStatus({
  status,
}: {
  readonly status: QrWorkspaceStatus
}) {
  if (status === "live") {
    return <MonoTag tone="leaf">Live and accepting scans</MonoTag>
  }

  if (status === "paused") {
    return <MonoTag tone="sun">Enabled · scans paused</MonoTag>
  }

  return <MonoTag tone="plain">Paused · no new scans</MonoTag>
}

export function workspaceHref(
  baseHref: string,
  channel: DistributionChannel,
  template: QrPosterTemplateId
) {
  const separator = baseHref.includes("?") ? "&" : "?"
  const anchor = channel === "print" ? "qr-poster-picker" : "qr-distribution"
  return `${baseHref}${separator}channel=${channel}&poster=${template}#${anchor}`
}

export function resolveDistributionChannel(
  value: string | undefined
): DistributionChannel {
  return value === "digital" ? "digital" : "print"
}

export function resolveQrPosterTemplate(
  value: string | undefined
): QrPosterTemplateId {
  return (
    QR_POSTER_PRODUCTION_TEMPLATES.find((item) => item.id === value)?.id ??
    "window"
  )
}

export function buildPosterHrefs(
  resolveHref: (id: QrPosterTemplateId) => string
): Readonly<Record<QrPosterTemplateId, string>> {
  return Object.fromEntries(
    QR_POSTER_PRODUCTION_TEMPLATES.map((item) => [
      item.id,
      resolveHref(item.id),
    ])
  ) as Readonly<Record<QrPosterTemplateId, string>>
}
