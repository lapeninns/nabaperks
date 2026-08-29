import Link from "next/link"

import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"
import { cn } from "@/lib/utils"

/**
 * The switcher every print preview shares: asset kind first, then the designs
 * within that kind.
 *
 * Before this existed only the poster preview could change design in place. A
 * merchant looking at a table tent, an NFC card or a wall plate had to go back
 * to /app/qr, scroll to the right lane and open another tab to see a second
 * design — for four assets that are otherwise the same screen.
 *
 * The kind row links to each asset's FIRST PRODUCTION design rather than a
 * hardcoded id, so a rollout change in config/*-designs.json moves the entry
 * point with it instead of pointing at a design merchants can no longer pick.
 */

export type PrintAssetNavKind = "poster" | "tent" | "nfc" | "nfc-square"

type PrintDesignOption = {
  readonly id: string
  readonly name: string
  readonly useCase: string
}

const KIND_LABEL: Record<PrintAssetNavKind, string> = {
  poster: "Posters",
  tent: "Table tents",
  nfc: "NFC cards",
  "nfc-square": "Wall plates",
}

const KIND_DESIGNS: Record<PrintAssetNavKind, readonly PrintDesignOption[]> = {
  poster: QR_POSTER_PRODUCTION_TEMPLATES,
  tent: TENT_PRODUCTION_DESIGNS,
  nfc: NFC_CARD_PRODUCTION_DESIGNS,
  "nfc-square": NFC_SQUARE_PRODUCTION_DESIGNS,
}

const KIND_ORDER: readonly PrintAssetNavKind[] = [
  "poster",
  "tent",
  "nfc",
  "nfc-square",
]

const STRIP_CLASS =
  "flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"

const PILL_CLASS =
  "focus-ring tap-floor flex min-h-11 shrink-0 items-center rounded-lg border-2 border-ink px-3.5 text-sm leading-none font-extrabold whitespace-nowrap transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"

function assetQuery(qrCodeId: string, backHref?: string): string {
  return `?qr=${qrCodeId}${backHref ? `&from=${encodeURIComponent(backHref)}` : ""}`
}

type PrintNavProps = {
  readonly kind: PrintAssetNavKind
  /** The merchant's own QR; without it there is nothing to link a design to. */
  readonly qrCodeId: string
  readonly backHref?: string
}

/** Poster · Table tents · NFC cards · Wall plates. */
export function PrintKindNav({ kind, qrCodeId, backHref }: PrintNavProps) {
  const query = assetQuery(qrCodeId, backHref)

  return (
    <nav aria-label="Print asset type" className={STRIP_CLASS}>
      {KIND_ORDER.map((entry) => {
        const isActive = entry === kind
        const first = KIND_DESIGNS[entry][0]
        if (!first) return null

        return (
          <Link
            key={entry}
            href={`/app/qr/${entry}/${first.id}${query}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              PILL_CLASS,
              "shadow-sm",
              isActive && "bg-ink text-paper shadow-md"
            )}
          >
            {KIND_LABEL[entry]}
          </Link>
        )
      })}
    </nav>
  )
}

/** The designs within one asset kind. */
export function PrintDesignNav({
  kind,
  activeDesignId,
  qrCodeId,
  backHref,
}: PrintNavProps & { readonly activeDesignId: string }) {
  const query = assetQuery(qrCodeId, backHref)

  return (
    <nav aria-label={`${KIND_LABEL[kind]} designs`} className={STRIP_CLASS}>
      {KIND_DESIGNS[kind].map((design) => {
        const isActive = design.id === activeDesignId

        return (
          <Link
            key={design.id}
            href={`/app/qr/${kind}/${design.id}${query}`}
            title={design.useCase}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              PILL_CLASS,
              "border-l-[3px] bg-card shadow-sm",
              isActive && "bg-paper-deep shadow-md"
            )}
          >
            {design.name}
          </Link>
        )
      })}
    </nav>
  )
}

/** Both rows, for the three previews that have no design switcher of their own. */
export function PrintPreviewNav({
  kind,
  activeDesignId,
  qrCodeId,
  backHref,
}: PrintNavProps & { readonly activeDesignId: string }) {
  return (
    <div className="grid min-w-0 gap-2">
      <PrintKindNav kind={kind} qrCodeId={qrCodeId} backHref={backHref} />
      <PrintDesignNav
        kind={kind}
        activeDesignId={activeDesignId}
        qrCodeId={qrCodeId}
        backHref={backHref}
      />
    </div>
  )
}
