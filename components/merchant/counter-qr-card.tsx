import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import {
  PresentQrRoot,
  PresentQrTrigger,
} from "@/components/merchant/present-qr"
import { getServerEnv } from "@/lib/env/server"
import {
  counterQrHasImage,
  resolveCounterQrState,
  type CounterQrState,
} from "@/lib/merchant/counter-qr-state"
import {
  buildLaunchReadiness,
  getLaunchBillingReadiness,
} from "@/lib/merchant/launch-readiness"
import { isLaunchSetupCompleteWithoutQr } from "@/lib/merchant/launch-readiness-core"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { logger } from "@/lib/observability/logger"
import { cn } from "@/lib/utils"

/**
 * The Counter's join QR. Loads the venue's live join QR and its launch
 * readiness; streamed in its own Suspense boundary so a failing read never
 * takes the team code down with it.
 */
export async function CounterQrCard() {
  const setup = await getQrSetup()
  const { qrCode, activeCard, merchant } = setup
  const venueName =
    merchant?.business_name ?? activeCard?.card_name ?? "your venue"

  const billing = merchant
    ? await getLaunchBillingReadiness(
        merchant.id,
        merchant.requires_billing !== false
      )
    : undefined
  const readiness = buildLaunchReadiness({
    activeCard,
    activeRewardPoolItemCount: setup.activeRewardPoolItemCount,
    qrCode,
    location: setup.location,
    billing,
  })
  const state = resolveCounterQrState({
    qrCode,
    launchReady: readiness.launchReady,
  })

  if (
    state === "missing" &&
    isLaunchSetupCompleteWithoutQr(readiness.checklist)
  ) {
    // ensure-join-qr.ts provisions the row once the card, rewards, venue and
    // billing gates are met; a missing row past that point is a bug worth a
    // durable log line. Before then its absence is ordinary first-run setup.
    logger.warn("counter.qr_missing", { merchantId: merchant?.id ?? null })
  }

  const env = getServerEnv()

  return (
    <PresentableQrCard
      state={state}
      qrCodeId={qrCode?.id ?? null}
      venueName={venueName}
      shareUrl={qrCode ? `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}` : null}
      gatedAction={readiness.nextStep ?? null}
    />
  )
}

/**
 * The QR's white frame: `min(62vw, 236px)` (58vw / 264px from 430px), and
 * never wider than its column, so the 600px two-up layout fits the card's
 * padding and borders instead of clipping the code.
 */
const QR_FRAME_CLASS =
  "box-border w-[min(62vw,14.75rem)] max-w-full rounded-md bg-white p-2 min-[430px]:w-[min(58vw,16.5rem)]"

export type PresentableQrCardProps = {
  readonly state: CounterQrState
  readonly qrCodeId: string | null
  readonly venueName: string
  readonly shareUrl: string | null
  /** Where "gated" sends the owner: the next launch step. */
  readonly gatedAction: { href: string; actionLabel: string } | null
}

/**
 * Presentational half — mounted DB-free by `/dev/app-harness/dashboard`.
 *
 * The whole card is the one way into present mode: a `<button>` carrying
 * the QR, the vermillion border (the Counter's first accent use) and the
 * mono "Tap to present" hint. Paused and gated venues draw the QR dimmed
 * under a solid chip and are not tappable; a missing QR is a receipt note
 * pointing at launch. Copy link and Poster & print are text links, not
 * buttons, so the card keeps its single primary.
 */
export function PresentableQrCard({
  state,
  qrCodeId,
  venueName,
  shareUrl,
  gatedAction,
}: PresentableQrCardProps) {
  if (!counterQrHasImage(state) || !qrCodeId) {
    return <MissingQrNote />
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies
    <img
      src={`/app/qr/image/${qrCodeId}?w=512`}
      alt={`QR code for ${venueName}`}
      width={512}
      height={512}
      className={cn(
        "block aspect-square h-auto w-full rounded-md bg-white",
        state !== "ready" && "opacity-40"
      )}
    />
  )

  const card =
    state === "ready" ? (
      <PresentQrTrigger>
        <button
          type="button"
          data-counter-qr={state}
          className="pressable grid w-full justify-items-center gap-3 rounded-lg border-2 border-primary bg-card p-4 shadow-md transition-shadow duration-[var(--w-dur-press)] ease-[var(--w-ease)] active:shadow-2xs motion-reduce:transition-none"
        >
          <span className={QR_FRAME_CLASS}>{image}</span>
          <span className="mono-meta text-ink-soft">Tap to present</span>
        </button>
      </PresentQrTrigger>
    ) : (
      <div
        data-counter-qr={state}
        className="grid w-full justify-items-center gap-3 rounded-lg border-2 border-ink bg-card p-4 shadow-xs"
      >
        <span className={cn("relative", QR_FRAME_CLASS)}>
          {image}
          <MonoTag
            tone="ink"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            {state === "paused" ? "Paused" : "Not live yet"}
          </MonoTag>
        </span>
        <p className="max-w-[28ch] text-center text-sm leading-6 text-muted-foreground">
          {state === "paused" ? (
            <>
              Customer scans are paused, so nobody can join from this code.{" "}
              <Link
                href="/app/qr"
                prefetch={false}
                className="focus-ring font-bold text-foreground underline underline-offset-4"
              >
                Resume under Poster &amp; print
              </Link>
            </>
          ) : (
            <>
              Customers cannot join until setup and billing are ready.{" "}
              <Link
                href={gatedAction?.href ?? "/app/launch"}
                prefetch={false}
                className="focus-ring font-bold text-foreground underline underline-offset-4"
              >
                {gatedAction?.actionLabel ?? "Finish setup"}
              </Link>
            </>
          )}
        </p>
      </div>
    )

  // Only a live QR advertises joining and hands out its link: a paused or
  // gated code would be a dead link. Those states keep Poster & print only.
  const links = (
    <div className="grid justify-items-center gap-2 text-center">
      {state === "ready" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Customers scan to join and take today&apos;s stamp.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-bold">
        {state === "ready" && shareUrl ? (
          <CopyUrlButton url={shareUrl} variant="link" label="Copy link" />
        ) : null}
        <Link
          href="/app/qr"
          prefetch={false}
          className="focus-ring inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
        >
          Poster &amp; print
        </Link>
      </div>
      {state === "ready" && shareUrl ? (
        // The link itself, selectable, so a failed clipboard copy still has
        // something to copy by hand.
        <p
          className="mono-id break-all text-ink-soft select-all"
          data-counter-share-url
        >
          {shareUrl.replace(/^https?:\/\//, "")}
        </p>
      ) : null}
    </div>
  )

  const body = (
    <section aria-label="Venue QR" className="grid gap-4">
      {card}
      {links}
    </section>
  )

  // The dialog root only mounts when there is something to present.
  return state === "ready" ? (
    <PresentQrRoot qrCodeId={qrCodeId} venueName={venueName}>
      {body}
    </PresentQrRoot>
  ) : (
    body
  )
}

function MissingQrNote() {
  return (
    <section
      aria-label="Venue QR"
      data-counter-qr="missing"
      className="grid gap-3 rounded-lg border-2 border-dashed border-line-strong bg-card p-5"
    >
      <p className="mono-meta text-ink-soft">Venue QR</p>
      <h2 className="text-xl leading-tight font-extrabold">
        Your venue QR is not ready yet
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Finish the QR step of launch and the code customers scan appears here.
      </p>
      <Link
        href="/app/launch?tab=qr"
        prefetch={false}
        className="focus-ring inline-flex min-h-11 w-fit items-center font-bold text-foreground underline underline-offset-4"
      >
        Open the QR step
      </Link>
    </section>
  )
}
