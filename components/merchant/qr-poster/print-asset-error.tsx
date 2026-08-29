import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"

/**
 * The one failure surface for every print asset — poster, table tent, NFC card
 * and wall plate.
 *
 * Each of the four print routes used to carry its own byte-identical copy of
 * this screen (and the NFC routes carried two), so a copy or accessibility fix
 * had to be made in six places and had already started to drift. The wording
 * per asset is data here; the shape is defined once.
 *
 * Two reasons reach it: a transient QR-PNG render failure, and a Google Review
 * asset opened before the venue has a review link to send guests to.
 */

export type PrintAssetKind = "poster" | "tent" | "nfc" | "nfc-square"

export type PrintAssetErrorReason = "render" | "review-link"

type PrintAssetErrorCopy = {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly bannerTitle: string
  readonly bannerBody: string
}

const RENDER_COPY: Record<PrintAssetKind, PrintAssetErrorCopy> = {
  poster: {
    eyebrow: "Counter poster",
    title: "Poster could not be generated",
    description:
      "The QR image failed to render just now. This is usually momentary — head back and reopen the poster.",
    bannerTitle: "QR render failed.",
    bannerBody:
      "If it keeps happening, check the venue QR is still live on the poster page.",
  },
  tent: {
    eyebrow: "Table tent",
    title: "Tent could not be generated",
    description:
      "The QR image failed to render just now. This is usually momentary — head back and reopen the tent.",
    bannerTitle: "QR render failed.",
    bannerBody:
      "If it keeps happening, check the venue QR is still live on the QR page.",
  },
  nfc: {
    eyebrow: "NFC card",
    title: "Card could not be generated",
    description:
      "The QR image failed to render just now. This is usually momentary — head back and reopen the card.",
    bannerTitle: "QR render failed.",
    bannerBody:
      "If it keeps happening, check the venue QR is still live on the QR page.",
  },
  "nfc-square": {
    eyebrow: "Square NFC",
    title: "Card could not be generated",
    description:
      "The QR image failed to render just now. This is usually momentary — head back and reopen the card.",
    bannerTitle: "QR render failed.",
    bannerBody:
      "If it keeps happening, check the venue QR is still live on the QR page.",
  },
}

/**
 * Only the two Google Review assets can fail this way, so the record is partial
 * rather than four entries with two of them unreachable.
 */
const REVIEW_LINK_COPY: Partial<Record<PrintAssetKind, PrintAssetErrorCopy>> = {
  nfc: {
    eyebrow: "Google Review card",
    title: "Add the venue review link first",
    description:
      "This card needs a valid Google review destination so its tap point and QR code never send guests to the wrong place.",
    bannerTitle: "Google review link missing.",
    bannerBody: "Add the venue’s Google review link, then reopen this card.",
  },
  "nfc-square": {
    eyebrow: "Google Review plate",
    title: "Add the venue review link first",
    description:
      "This plate needs a valid Google review destination so its tap point and QR code never send guests to the wrong place.",
    bannerTitle: "Google review link missing.",
    bannerBody: "Add the venue’s Google review link, then reopen this plate.",
  },
}

export function PrintAssetError({
  kind,
  reason,
  backHref,
}: {
  readonly kind: PrintAssetKind
  readonly reason: PrintAssetErrorReason
  readonly backHref: string
}) {
  const copy =
    (reason === "review-link" ? REVIEW_LINK_COPY[kind] : undefined) ??
    RENDER_COPY[kind]

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          titleClassName="sm:text-2xl"
        />
        <StatusBanner tone="error" title={copy.bannerTitle}>
          {copy.bannerBody}
        </StatusBanner>
        <Button asChild variant="outline" className="w-fit">
          <Link href={backHref}>
            <Icon icon={ArrowLeft01Icon} size={16} />
            Back to QR
          </Link>
        </Button>
      </ReceiptCard>
    </main>
  )
}
