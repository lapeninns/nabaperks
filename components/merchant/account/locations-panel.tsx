import Link from "next/link"
import { redirect } from "next/navigation"
import type { InputHTMLAttributes } from "react"
import { QrCode01Icon, Store01Icon } from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { addVenueLocationAction } from "@/app/app/account/actions"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantLocationQrSummaries,
  type MerchantLocationQrSummary,
} from "@/lib/merchant/location"
import { cn } from "@/lib/utils"

type LocationFormAction = (formData: FormData) => void | Promise<void>

type LocationsPanelViewProps = {
  readonly locations: readonly MerchantLocationQrSummary[]
  readonly status?: string | null
  readonly formAction?: LocationFormAction
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
    body: "The location was saved, but the card snapshot could not be created.",
  },
  "reward-error": {
    tone: "error",
    body: "The location was saved, but it needs at least 3 active rewards before a join QR can be created.",
  },
  "qr-error": {
    tone: "error",
    body: "The location was saved, but the join QR could not be created.",
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
    />
  )
}

export function LocationsPanelView({
  locations,
  status,
  formAction,
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
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      </ReceiptCard>

      <ReceiptCard className="grid gap-4">
        <SectionHeader
          eyebrow="Draft"
          title="Add another location"
          description="Card and rewards are a snapshot of your primary site at the time this location was added. Editing cloned cards is out of scope for this spike."
        />
        <form action={formAction} className="grid gap-4">
          <LocationField
            id="locationName"
            name="locationName"
            label="Location name"
            placeholder="White Horse Milton"
            autoComplete="organization"
            required
          />
          <LocationField
            id="addressLine1"
            name="addressLine1"
            label="Address line 1"
            placeholder="1 High Street"
            autoComplete="address-line1"
            required
          />
          <LocationField
            id="addressLine2"
            name="addressLine2"
            label="Address line 2"
            placeholder="Optional"
            autoComplete="address-line2"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <LocationField
              id="addressCity"
              name="addressCity"
              label="Town or city"
              placeholder="Cambridge"
              autoComplete="address-level2"
              required
            />
            <LocationField
              id="addressPostcode"
              name="addressPostcode"
              label="Postcode"
              placeholder="CB24 6DF"
              autoComplete="postal-code"
              required
            />
          </div>
          <input type="hidden" name="geofenceRadiusMeters" value="150" />
          <input type="hidden" name="geofencePinSource" value="geocoded" />
          <Button type="submit" className="w-full sm:w-fit">
            Create location QR
          </Button>
        </form>
      </ReceiptCard>
    </section>
  )
}

function LocationCard({
  location,
}: {
  readonly location: MerchantLocationQrSummary
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
        <p className="rounded-lg border-2 border-dashed border-line bg-card p-3 text-sm font-semibold text-muted-foreground">
          Create at least 3 active rewards for this location before its join QR
          appears.
        </p>
      )}
    </article>
  )
}

function LocationField({
  id,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string
  readonly label: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"
        {...props}
      />
    </div>
  )
}
