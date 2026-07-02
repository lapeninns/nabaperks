import Link from "next/link"
import { redirect } from "next/navigation"
import { QrCode01Icon, Store01Icon } from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Button } from "@/components/ui/button"
import {
  addVenueLocationAction,
  createLocationJoinQrAction,
  type AddLocationFormState,
} from "@/app/app/account/actions"
import { AddLocationForm } from "@/components/merchant/account/add-location-form"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantLocationQrSummaries,
  type MerchantLocationQrSummary,
} from "@/lib/merchant/location"
import { cn } from "@/lib/utils"

type LocationFormAction = (
  state: AddLocationFormState,
  formData: FormData
) => Promise<AddLocationFormState>

type LocationRetryAction = (formData: FormData) => void | Promise<void>

type LocationsPanelViewProps = {
  readonly locations: readonly MerchantLocationQrSummary[]
  readonly status?: string | null
  readonly formAction?: LocationFormAction
  /** Per-location "create join QR" repair action (absent in the harness). */
  readonly retryAction?: LocationRetryAction
}

const LOCATION_STATUS_COPY: Record<
  string,
  { readonly tone: "success" | "error"; readonly body: string }
> = {
  saved: {
    tone: "success",
    body: "Location saved. Its card, rewards, and join QR are ready to review.",
  },
  invalid: {
    tone: "error",
    body: "Check the location name and address details, then try again.",
  },
  "location-error": {
    tone: "error",
    body: "The location could not be saved. Try again from the account screen.",
  },
  "card-error": {
    tone: "error",
    body: "The location was saved, but the card snapshot could not be created. Use Create join QR on the site card to retry.",
  },
  "reward-error": {
    tone: "error",
    body: "The location was saved, but it needs at least 3 active rewards. Top up your primary site's reward pool, then use Create join QR on the site card.",
  },
  "qr-error": {
    tone: "error",
    body: "The location was saved, but the join QR could not be created. Use Create join QR on the site card to retry.",
  },
}

export async function LocationsPanel({
  status,
}: {
  readonly status?: string | null
}) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const locations = await getMerchantLocationQrSummaries(merchant.id)

  return (
    <LocationsPanelView
      locations={locations}
      status={status}
      formAction={addVenueLocationAction}
      retryAction={createLocationJoinQrAction}
    />
  )
}

export function LocationsPanelView({
  locations,
  status,
  formAction,
  retryAction,
}: LocationsPanelViewProps) {
  const statusCopy = status ? LOCATION_STATUS_COPY[status] : null

  return (
    <section className="grid min-w-0 gap-5">
      {statusCopy ? (
        <p
          className={cn(
            "rounded-lg border-2 px-4 py-3 text-sm font-semibold",
            statusCopy.tone === "success"
              ? "border-leaf bg-leaf/10 text-ink"
              : "border-destructive bg-destructive/10 text-destructive"
          )}
        >
          {statusCopy.body}
        </p>
      ) : null}

      <ReceiptCard className="grid gap-4">
        <SectionHeader
          eyebrow="Sites"
          title="Locations"
          description="Each site keeps its own join QR and active card snapshot. Members stay shared across your business."
        />
        <div className="grid gap-3">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              retryAction={retryAction}
            />
          ))}
        </div>
      </ReceiptCard>

      <ReceiptCard className="grid gap-4">
        {/* Scope note (engineering, not merchant-facing): per-location card
            editing does not exist yet — each location takes a one-off snapshot
            of the primary site's card and rewards at add time, and rewards are
            only manageable on the primary card (see addVenueLocationAction). */}
        <SectionHeader
          eyebrow="Draft"
          title="Add another location"
          description="New locations start with a copy of your primary site's card and rewards, taken when the location is added. Copied cards cannot be edited per location yet — manage rewards on your primary site."
        />
        <AddLocationForm action={formAction} />
      </ReceiptCard>
    </section>
  )
}

function LocationCard({
  location,
  retryAction,
}: {
  readonly location: MerchantLocationQrSummary
  readonly retryAction?: LocationRetryAction
}) {
  return (
    <article className="grid gap-3 rounded-lg border-2 border-ink bg-secondary/35 p-4 shadow-[var(--shadow-hard-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{location.isPrimary ? "Primary" : "Site"}</p>
          <h3 className="text-lg leading-tight font-black text-balance">
            {location.name}
          </h3>
          {location.address ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {location.address}
            </p>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1 text-xs font-black">
          <Icon icon={Store01Icon} size={14} />
          {location.activeCardName ?? "No active card"}
        </span>
      </div>

      {location.joinQrPath && location.pngPath ? (
        <div className="grid gap-2 rounded-lg border-2 border-line bg-card p-3">
          <p className="eyebrow">Join QR</p>
          <code className="min-w-0 break-all rounded-md bg-secondary px-2 py-1 text-sm font-bold">
            {location.joinQrPath}
          </code>
          <Button asChild variant="secondary" size="sm" className="w-fit">
            <Link href={location.pngPath} prefetch={false}>
              <Icon icon={QrCode01Icon} size={15} />
              Download PNG for {location.name}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border-2 border-dashed border-line bg-card p-3">
          <p className="text-sm font-semibold text-muted-foreground">
            This site&apos;s join QR is not ready yet. It needs a card with at
            least 3 active rewards, copied from your primary site.
          </p>
          {/* Repair affordance for the half-created state: re-runs the
              card/reward/QR steps for THIS location instead of forcing a
              duplicate location through the add form (MER-P2-13). */}
          {retryAction ? (
            <form action={retryAction}>
              <input type="hidden" name="locationId" value={location.id} />
              <SubmitButton
                variant="secondary"
                size="sm"
                className="w-fit"
                pendingLabel="Creating join QR…"
              >
                <Icon icon={QrCode01Icon} size={15} />
                Create join QR for {location.name}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      )}
    </article>
  )
}
