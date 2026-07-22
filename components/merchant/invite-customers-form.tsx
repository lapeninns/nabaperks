"use client"

import { useActionState } from "react"

import {
  loyaltyInviteFormAction,
  type LoyaltyInviteState,
} from "@/app/app/customers/invite/actions"
import { Eyebrow } from "@/components/brand"
import { FormMessage, SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { TextareaField } from "@/components/merchant/loyalty-card-form"
import type { LoyaltyInviteCampaignSummary } from "@/lib/merchant/loyalty-invites"

const initialState: LoyaltyInviteState = { step: "input" }

const LEGAL_BASES = [
  {
    value: "venue_email_consent",
    label: "These customers gave this venue consent to email them.",
  },
  {
    value: "existing_customer_soft_opt_in",
    label:
      "These are existing customers who bought from this venue, were told about marketing, and can opt out — and none has opted out.",
  },
] as const

export function InviteCustomersForm({
  activeCampaign,
}: {
  activeCampaign: LoyaltyInviteCampaignSummary | null
}) {
  const [state, action] = useActionState(loyaltyInviteFormAction, initialState)

  if (state.message) {
    return (
      <StatusBanner tone="success" title="Done.">
        {state.message}
      </StatusBanner>
    )
  }

  if (activeCampaign && activeCampaign.status === "sending") {
    return (
      <InProgressCard
        campaign={activeCampaign}
        action={action}
        formError={state.errors?.form}
      />
    )
  }

  const preview = state.preview

  return (
    <form action={action} className="grid gap-6">
      {state.errors?.form ? (
        <StatusBanner tone="error" title="Something went wrong.">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      <TextareaField
        id="recipients"
        label="Email addresses"
        name="recipients"
        rows={8}
        defaultValue={state.fields?.recipients}
        placeholder={"alex@example.com\njordan@example.com"}
        hint="Paste up to 2,000 addresses, one per line or comma-separated, or a CSV with an 'email' column. Each invitation offers two welcome stamps and expires after 30 days."
        error={state.errors?.recipients}
      />

      {preview ? (
        <PreviewPanel
          preview={preview}
          legalError={state.errors?.legalBasis}
          attestationError={state.errors?.attestation}
        />
      ) : (
        <div>
          <SubmitButton name="intent" value="preview">
            Check list
          </SubmitButton>
        </div>
      )}
    </form>
  )
}

function PreviewPanel({
  preview,
  legalError,
  attestationError,
}: {
  preview: NonNullable<LoyaltyInviteState["preview"]>
  legalError?: string
  attestationError?: string
}) {
  return (
    <div className="grid gap-5 rounded-lg border-2 border-ink bg-paper p-5">
      <input type="hidden" name="campaignId" value={preview.campaignId} />

      <div>
        <Eyebrow>Preview</Eyebrow>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Count label="Eligible" value={preview.eligible} emphasis />
          <Count label="Not eligible" value={preview.notEligible} />
          <Count label="Duplicates" value={preview.duplicate} />
          <Count label="Invalid" value={preview.invalid} />
        </dl>
        {preview.sample.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            For example: {preview.sample.join(", ")}
          </p>
        ) : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">
          Confirm your lawful basis for emailing these customers
        </legend>
        {LEGAL_BASES.map((basis) => (
          <label key={basis.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="legalBasis"
              value={basis.value}
              className="mt-1"
              required
            />
            <span>{basis.label}</span>
          </label>
        ))}
        {legalError ? <FormMessage>{legalError}</FormMessage> : null}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="attestation" className="mt-1" />
        <span>
          I confirm this list isn&apos;t bought, scraped or third-party, and I
          have a lawful basis to email everyone on it.
        </span>
      </label>
      {attestationError ? <FormMessage>{attestationError}</FormMessage> : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton name="intent" value="send">
          Send {preview.eligible.toLocaleString("en-GB")} invitation
          {preview.eligible === 1 ? "" : "s"}
        </SubmitButton>
        <SubmitButton name="intent" value="preview" variant="secondary">
          Re-check list
        </SubmitButton>
      </div>
    </div>
  )
}

function InProgressCard({
  campaign,
  action,
  formError,
}: {
  campaign: LoyaltyInviteCampaignSummary
  action: (formData: FormData) => void
  formError?: string
}) {
  const counts = campaign.statusCounts
  const sent =
    (counts.sent ?? 0) +
    (counts.delivered ?? 0) +
    (counts.opened ?? 0) +
    (counts.joined ?? 0)
  const joined = counts.joined ?? 0
  const queued = (counts.queued ?? 0) + (counts.sending ?? 0)

  return (
    <div className="grid gap-4 rounded-lg border-2 border-ink bg-paper p-5">
      {formError ? (
        <StatusBanner tone="error" title="Something went wrong.">
          {formError}
        </StatusBanner>
      ) : null}
      <div>
        <Eyebrow>Campaign in progress</Eyebrow>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Count label="Eligible" value={campaign.eligibleCount} emphasis />
          <Count label="Sent" value={sent} />
          <Count label="Awaiting send" value={queued} />
          <Count label="Joined" value={joined} />
        </dl>
      </div>
      <p className="text-sm text-muted-foreground">
        Invitations are sent gradually. Cancelling stops any that haven&apos;t
        sent and invalidates unclaimed links; emails already sent can&apos;t be
        recalled.
      </p>
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <SubmitButton name="intent" value="cancel" variant="secondary">
          Cancel campaign
        </SubmitButton>
      </form>
    </div>
  )
}

function Count({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={emphasis ? "text-lg font-bold" : "text-lg"}>
        {value.toLocaleString("en-GB")}
      </dd>
    </div>
  )
}
