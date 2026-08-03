import {
  Alert02Icon,
  DiscountTag01Icon,
  ToggleOffIcon,
  ToggleOnIcon,
} from "@hugeicons/core-free-icons"

import { setMerchantOfferCampaignsAction } from "@/app/admin/actions"
import { AdminActionForm } from "@/components/admin/action-form"
import {
  AdminConfirmCheck,
  AdminPanel,
  SourceLabel,
  StatusPill,
} from "@/components/admin/support"
import { AdminRecordActions } from "@/components/admin/record-actions"
import { AdminRecordCard } from "@/components/admin/record-card"
import { EmptyState, Icon, SectionHeader } from "@/components/brand"
import { DataTable } from "@/components/data/data-table"
import { SubmitButton } from "@/components/forms"
import type {
  OfferPilotAllowlist,
  OfferPilotVenue,
} from "@/lib/admin/offer-allowlist"

/**
 * The operator surface for the Offers pilot allowlist.
 *
 * Before this existed the only way to start a venue's pilot was to run
 * `admin_set_merchant_offer_campaigns` by hand against the database. The RPC
 * was written, granted and privilege-tested, and nothing ever called it.
 */
export function OfferPilotPanel({
  allowlist,
}: {
  readonly allowlist: OfferPilotAllowlist
}) {
  return (
    <AdminPanel id="offers-pilot" className="scroll-mt-6">
      <SectionHeader
        title="Offers pilot allowlist"
        description="Turning Offers on shows the Offers section to that venue's merchants so they can build a campaign. It publishes nothing — the venue still has to create and publish an offer itself. Turning it off hides the section again and stops new claims; discount passes customers already hold are not cancelled and stay redeemable when the venue is turned back on."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={allowlist.enabledCount ? "good" : "neutral"}>
              {allowlist.enabledCount} of {allowlist.venues.length} in the pilot
            </StatusPill>
            <SourceLabel>Source: merchants.offer_campaigns_enabled</SourceLabel>
          </div>
        }
      />

      <FeatureFlagNotice enabled={allowlist.featureFlagEnabled} />

      <DataTable
        caption="Offers pilot allowlist by venue"
        cardBreakpoint="xl"
        className="rounded-lg shadow-none"
        rows={allowlist.venues}
        getRowKey={(venue) => venue.id}
        emptyState={
          <EmptyState
            icon={DiscountTag01Icon}
            title="No merchants yet"
            description="Venues appear here once onboarding creates merchant records."
            className="rounded-none border-0 p-0 shadow-none"
          />
        }
        columns={[
          {
            key: "venue",
            header: "Venue",
            cell: (venue) => (
              <div className="grid gap-1">
                <span className="font-bold">{venue.businessName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {venue.businessSlug}
                </span>
              </div>
            ),
          },
          {
            key: "offers",
            header: "Offers",
            cell: (venue) => <OfferStatusPill venue={venue} />,
          },
          {
            key: "control",
            header: "Pilot control",
            cell: (venue) => <OfferPilotToggleForm venue={venue} />,
          },
        ]}
        mobileCard={(venue) => (
          <AdminRecordCard
            title={venue.businessName}
            eyebrow={venue.businessSlug}
            status={<OfferStatusPill venue={venue} />}
            fields={[
              {
                label: "Offers section",
                value: venue.offersEnabled
                  ? "Visible to this venue's merchants."
                  : "Hidden from this venue's merchants.",
              },
            ]}
            action={
              <AdminRecordActions
                label={
                  venue.offersEnabled ? "Turn Offers off" : "Turn Offers on"
                }
                group="offers-pilot"
              >
                <OfferPilotToggleForm venue={venue} />
              </AdminRecordActions>
            }
          />
        )}
      />
    </AdminPanel>
  )
}

function OfferStatusPill({ venue }: { readonly venue: OfferPilotVenue }) {
  return (
    <StatusPill tone={venue.offersEnabled ? "good" : "neutral"}>
      {venue.offersEnabled ? "in the pilot" : "not in the pilot"}
    </StatusPill>
  )
}

/**
 * The allowlist is one of two gates. `lib/offers/access.ts` requires the
 * `merchant_offer_campaigns` flag as well, so with the flag off an allowlisted
 * venue still sees nothing — say so here rather than let an operator conclude
 * the toggle is broken.
 */
function FeatureFlagNotice({ enabled }: { readonly enabled: boolean }) {
  if (enabled) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        The <code className="font-mono text-xs">merchant_offer_campaigns</code>{" "}
        feature flag is on in this environment, so an allowlisted venue sees the
        Offers section straight away.
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 rounded-lg border-2 border-ink bg-primary/12 px-3 py-2 text-sm leading-6 font-semibold text-foreground">
      <Icon icon={Alert02Icon} size={16} className="mt-1 shrink-0" />
      <span className="font-normal">
        The <code className="font-mono text-xs">merchant_offer_campaigns</code>{" "}
        feature flag is off in this environment, so allowlisting a venue changes
        nothing it can see yet. Set{" "}
        <code className="font-mono text-xs">
          NABAPERKS_FEATURE_MERCHANT_OFFER_CAMPAIGNS=true
        </code>{" "}
        for this environment as well.
      </span>
    </p>
  )
}

function OfferPilotToggleForm({ venue }: { readonly venue: OfferPilotVenue }) {
  const turningOn = !venue.offersEnabled

  return (
    <AdminActionForm action={setMerchantOfferCampaignsAction}>
      <input type="hidden" name="merchantId" value={venue.id} />
      <input type="hidden" name="enabled" value={String(turningOn)} />
      <AdminConfirmCheck
        label={
          turningOn
            ? `I understand this shows the Offers section to ${venue.businessName}'s merchants and publishes nothing on their behalf.`
            : `I understand this hides the Offers section from ${venue.businessName} and stops new claims, and that passes customers already hold are not cancelled.`
        }
      />
      <SubmitButton
        pendingLabel={turningOn ? "Turning on…" : "Turning off…"}
        variant={turningOn ? "secondary" : "destructive"}
        className="justify-start"
      >
        <Icon icon={turningOn ? ToggleOnIcon : ToggleOffIcon} size={16} />
        {turningOn ? "Turn Offers on" : "Turn Offers off"}
      </SubmitButton>
    </AdminActionForm>
  )
}
