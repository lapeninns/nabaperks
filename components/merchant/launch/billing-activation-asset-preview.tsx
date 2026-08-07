import { Eyebrow, MonoTag, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"

type BillingActivationAssetPreviewProps = Readonly<{
  venueName: string
  cardName: string
  stampsRequired: number
  qrCodeId: string
}>

/**
 * Read-only continuity cue beside first-run billing. It uses the setup model
 * already loaded by the launch page and the authenticated QR image route, so
 * checkout stays the only action and this surface adds no fetch or hydration.
 */
export function BillingActivationAssetPreview({
  venueName,
  cardName,
  stampsRequired,
  qrCodeId,
}: BillingActivationAssetPreviewProps) {
  const safeStampCount = Math.min(Math.max(stampsRequired, 1), 12)

  return (
    <section aria-label="Built card and QR preview" className="min-w-0">
      <ReceiptCard
        padding="sm"
        className="grid min-w-0 gap-4 overflow-hidden bg-paper-deep/35"
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <Eyebrow>Here&apos;s your card</Eyebrow>
            <h2 className="text-lg leading-snug font-extrabold text-balance break-words">
              {cardName}
            </h2>
          </div>
          <MonoTag tone="sun">Built · billing needed</MonoTag>
        </div>

        <div className="grid min-w-0 gap-4 min-[360px]:grid-cols-[8.75rem_minmax(0,1fr)] min-[360px]:items-start">
          <QrFrame
            label={`Venue QR for ${venueName}`}
            className="mx-auto min-h-0 w-[8.75rem] min-w-0 overflow-hidden p-3 shadow-[4px_4px_0_var(--w-shadow-color)] min-[360px]:mx-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images require merchant cookies */}
            <img
              src={`/app/qr/image/${qrCodeId}`}
              alt={`QR code for ${venueName}`}
              width={96}
              height={96}
              className="block aspect-square size-24 object-contain"
            />
          </QrFrame>

          <div className="grid min-w-0 gap-3">
            <div className="grid min-w-0 gap-1">
              <p className="mono-id text-muted-foreground">{venueName}</p>
              <p className="text-sm leading-5 font-bold">
                {safeStampCount} {safeStampCount === 1 ? "visit" : "visits"}
              </p>
            </div>
            <BillingStampCadence stampsRequired={safeStampCount} />
          </div>
        </div>

        <p className="border-t-2 border-dashed border-ink/20 pt-3 text-sm leading-6 text-muted-foreground">
          Your card is built. Add billing to switch on customer scans.
        </p>
      </ReceiptCard>
    </section>
  )
}

/** Static setup preview: no motion/client boundary before checkout. */
function BillingStampCadence({ stampsRequired }: { stampsRequired: number }) {
  return (
    <div
      role="list"
      aria-label={`0 of ${stampsRequired} stamps earned, mystery reward at the end`}
      data-billing-static-cadence
      className="grid grid-cols-4 gap-1.5"
    >
      {Array.from({ length: stampsRequired }, (_, index) => (
        <span key={index} role="listitem">
          <span
            role="img"
            aria-label={`Stamp ${index + 1} empty`}
            className="grid aspect-square min-h-9 w-full place-items-center rounded-full border-2 border-dashed border-border bg-background font-mono text-micro font-bold text-muted-foreground"
          >
            {index + 1}
          </span>
        </span>
      ))}
      <span role="listitem" className="grid justify-items-center gap-1">
        <span
          role="img"
          aria-label="Mystery reward sealed"
          className="grid aspect-square min-h-9 w-full -rotate-6 place-items-center rounded-md border-2 border-dashed border-line-strong bg-seal/15 shadow-xs"
        >
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center rounded-full border-2 border-ink bg-seal font-mono text-xs leading-none font-extrabold text-seal-foreground"
          >
            ?
          </span>
        </span>
        <span className="mono-id text-muted-foreground">Reward</span>
      </span>
    </div>
  )
}
