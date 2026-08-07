"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import {
  CheckmarkCircle02Icon,
  ShieldUserIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  loyaltyInviteFormAction,
  type LoyaltyInviteState,
} from "@/app/app/customers/invite/actions"
import { Eyebrow, Icon, MonoTag, SectionHeader } from "@/components/brand"
import { FormMessage, SubmitButton } from "@/components/forms"
import { ProgressTrack } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { InvitationPreview } from "@/components/merchant/invite/invitation-preview"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { WhatHappensNext } from "@/components/merchant/invite/what-happens-next"
import { TextareaField } from "@/components/merchant/loyalty-card-form"
import { LOYALTY_INVITE_MAX_RECIPIENTS } from "@/lib/loyalty-invites/constants"
import type { LoyaltyInviteCampaignSummary } from "@/lib/merchant/loyalty-invites"
import { cn } from "@/lib/utils"

const initialState: LoyaltyInviteState = { step: "input" }

// A short tile heading plus the full legal wording. Values must stay verbatim —
// the server validates them; the long labels are the audited attestation copy.
const LEGAL_BASES = [
  {
    value: "venue_email_consent",
    title: "They gave this venue consent",
    label: "These customers gave this venue consent to email them.",
  },
  {
    value: "existing_customer_soft_opt_in",
    title: "Existing customers, soft opt-in",
    label:
      "These are existing customers who bought from this venue, were told about marketing, and can opt out — and none has opted out.",
  },
] as const

// Approximate live counter for the compose field — a friendly hint as the
// merchant pastes, never authoritative. The real valid/duplicate/invalid split
// (and DB eligibility) is resolved by "Check list" on the server. Kept in sync
// with the parser's shape rule (import-core's EMAIL_RE) without importing it,
// since that module transitively pulls in node:crypto.
/** Shared shell for the lawful-basis radios and the attestation checkbox. */
const COMPLIANCE_TILE_CLASS =
  "focus-ring-within tap-floor flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-2 border-ink/25 bg-card p-3.5 transition-[border-color,background-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] has-checked:border-ink has-checked:bg-secondary has-checked:shadow-[var(--shadow-hard-sm)] motion-reduce:transition-none"

const RECOGNISED_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
function countRecognised(raw: string): number {
  return raw
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter((token) => RECOGNISED_EMAIL_RE.test(token)).length
}

export function InviteCustomersForm({
  activeCampaign,
  merchantName,
  seedState = initialState,
}: {
  activeCampaign: LoyaltyInviteCampaignSummary | null
  merchantName: string
  /**
   * Seeds `useActionState` so the DB-free dev harness can render the preview,
   * confirm and sent states for visual / a11y proof. Production never sets it —
   * the live flow reaches those states through the server action.
   */
  seedState?: LoyaltyInviteState
}) {
  const [state, action] = useActionState(loyaltyInviteFormAction, seedState)

  if (state.message) {
    return <SentConfirmation message={state.message} />
  }

  // The payoff first, the work second — on a phone the merchant used to scroll
  // past the entire compose form to reach the preview of what they are about to
  // send, then scroll back. `order-first` in DeskLayout hoists the rail above
  // the form below `lg`; the desk layout is unchanged. The four-step explainer
  // folds into a Disclosure so it costs a summary row rather than ~260px on
  // every visit, on both axes.
  const rail = (
    <div className="grid content-start gap-4 lg:sticky lg:top-6 lg:gap-6">
      <InvitationPreview merchantName={merchantName} />
      <Disclosure label="How it works" summaryClassName="min-h-11">
        <WhatHappensNext />
      </Disclosure>
    </div>
  )

  // A campaign that is still actively sending blocks starting another (one in
  // flight at a time) — show only its status alongside the invitation preview.
  if (activeCampaign?.status === "sending") {
    return (
      <DeskLayout aside={rail}>
        <CampaignStatusCard
          campaign={activeCampaign}
          action={action}
          formError={state.errors?.form}
        />
      </DeskLayout>
    )
  }

  const preview = state.preview

  return (
    <DeskLayout aside={rail}>
      <div className="grid gap-6">
        {state.errors?.form ? (
          <StatusBanner tone="error" title="Something went wrong.">
            {state.errors.form}
          </StatusBanner>
        ) : null}

        {/* A completed campaign keeps its revoke card ALONGSIDE a fresh compose
            form, so a merchant can send another batch without cancelling. */}
        {activeCampaign?.status === "completed" ? (
          <CampaignStatusCard campaign={activeCampaign} action={action} />
        ) : null}

        <form
          action={action}
          className="surface-card grid min-w-0 gap-5 p-4 sm:p-6"
        >
          <SectionHeader
            eyebrow="Compose"
            title="Who are you inviting?"
            description="Paste the customers you already have permission to email — we'll check the list before anything sends."
          />

          <RecipientsField
            defaultValue={state.fields?.recipients}
            error={state.errors?.recipients}
          />

          {preview ? (
            <PreviewConfirm
              preview={preview}
              legalError={state.errors?.legalBasis}
              attestationError={state.errors?.attestation}
            />
          ) : (
            <div>
              <SubmitButton
                name="intent"
                value="preview"
                pendingLabel="Checking…"
              >
                Check list
              </SubmitButton>
            </div>
          )}
        </form>
      </div>
    </DeskLayout>
  )
}

function DeskLayout({
  children,
  aside,
}: {
  children: React.ReactNode
  aside: React.ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      <div className="min-w-0 lg:order-none">{children}</div>
      <div className="order-first min-w-0 lg:order-none">{aside}</div>
    </div>
  )
}

function RecipientsField({
  defaultValue,
  error,
}: {
  defaultValue?: string
  error?: string
}) {
  const [count, setCount] = useState(() => countRecognised(defaultValue ?? ""))
  const overLimit = count > LOYALTY_INVITE_MAX_RECIPIENTS

  return (
    <div className="grid gap-2">
      <TextareaField
        id="recipients"
        label="Email addresses"
        name="recipients"
        // Five rows that grow with the paste, not eight rows of empty box:
        // `field-sizing-content` lets the control size to what is actually in
        // it, with min/max rows so it neither collapses nor runs away.
        rows={5}
        className="field-sizing-content max-h-72 min-h-32"
        defaultValue={defaultValue}
        onInput={(event) =>
          setCount(countRecognised(event.currentTarget.value))
        }
        placeholder={"alex@example.com\njordan@example.com"}
        hint="Paste up to 2,000 addresses — one per line or comma-separated, or a CSV with an 'email' column. Each invitation is worth two welcome stamps and expires after 30 days."
        error={error}
      />
      <p
        aria-live="polite"
        className={cn(
          "mono-meta flex min-h-4 items-center gap-1.5",
          overLimit ? "text-destructive-strong" : "text-muted-foreground"
        )}
      >
        {count > 0 ? (
          <>
            <Icon icon={UserMultiple02Icon} size={13} strokeWidth={2.25} />
            {count.toLocaleString("en-GB")}{" "}
            {count === 1 ? "address" : "addresses"} recognised
            {overLimit
              ? ` · over the ${LOYALTY_INVITE_MAX_RECIPIENTS.toLocaleString(
                  "en-GB"
                )} limit`
              : null}
          </>
        ) : null}
      </p>
    </div>
  )
}

function PreviewConfirm({
  preview,
  legalError,
  attestationError,
}: {
  preview: NonNullable<LoyaltyInviteState["preview"]>
  legalError?: string
  attestationError?: string
}) {
  return (
    <div className="grid gap-5 border-t border-border pt-5">
      <input type="hidden" name="campaignId" value={preview.campaignId} />

      <PreviewStats preview={preview} />

      {preview.sample.length > 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          For example:{" "}
          <span className="text-foreground">{preview.sample.join(", ")}</span>
        </p>
      ) : null}

      {preview.eligible === 0 ? (
        <div className="grid gap-4">
          <StatusBanner tone="info" title="Nothing to send yet">
            None of these addresses are eligible right now — they may already be
            members, have unsubscribed, or have been invited before. Adjust the
            list and check again.
          </StatusBanner>
          <div>
            <SubmitButton
              name="intent"
              value="preview"
              variant="secondary"
              pendingLabel="Checking…"
            >
              Re-check list
            </SubmitButton>
          </div>
        </div>
      ) : (
        <ConfirmAndSend
          preview={preview}
          legalError={legalError}
          attestationError={attestationError}
        />
      )}
    </div>
  )
}

function PreviewStats({
  preview,
}: {
  preview: NonNullable<LoyaltyInviteState["preview"]>
}) {
  const excluded = [
    { label: "Not eligible", value: preview.notEligible },
    { label: "Duplicates", value: preview.duplicate },
    { label: "Invalid", value: preview.invalid },
  ].filter((bucket) => bucket.value > 0)

  return (
    <div className="grid gap-2">
      <Eyebrow>List checked</Eyebrow>
      <p className="flex items-baseline gap-2">
        <span className="numeric-tabular text-3xl leading-none font-extrabold text-foreground">
          {preview.eligible.toLocaleString("en-GB")}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          {preview.eligible === 1 ? "customer" : "customers"} ready to invite
        </span>
      </p>
      {excluded.length > 0 ? (
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {excluded.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-1.5">
              <dd className="numeric-tabular text-sm font-bold text-foreground">
                {bucket.value.toLocaleString("en-GB")}
              </dd>
              <dt className="mono-meta text-muted-foreground">
                {bucket.label}
              </dt>
            </div>
          ))}
        </dl>
      ) : null}
      {preview.notEligible > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Not eligible = already members, unsubscribed, or invited before.
        </p>
      ) : null}
    </div>
  )
}

function ConfirmAndSend({
  preview,
  legalError,
  attestationError,
}: {
  preview: NonNullable<LoyaltyInviteState["preview"]>
  legalError?: string
  attestationError?: string
}) {
  return (
    <div className="grid gap-4 rounded-lg border-2 border-ink bg-secondary/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon icon={ShieldUserIcon} size={16} strokeWidth={2.25} />
        <Eyebrow>Confirm &amp; send</Eyebrow>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-foreground">
          Your lawful basis for emailing these customers
        </legend>
        {LEGAL_BASES.map((basis) => (
          <label
            key={basis.value}
            // These attestations are the GDPR gate for the whole feature, so
            // the answered state has to be unmistakable: full ink border, the
            // secondary ground and the hard shadow, not a border alpha nudge.
            // The tile also carries the 44px tap floor the 16px native control
            // could never meet on its own.
            className={COMPLIANCE_TILE_CLASS}
          >
            <input
              type="radio"
              name="legalBasis"
              value={basis.value}
              required
              className="mt-0.5 size-5 shrink-0 accent-[var(--w-ink)]"
            />
            <span className="grid min-w-0 gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {basis.title}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {basis.label}
              </span>
            </span>
          </label>
        ))}
        {legalError ? <FormMessage>{legalError}</FormMessage> : null}
      </fieldset>

      <div className="grid gap-1.5">
        <label className={COMPLIANCE_TILE_CLASS}>
          <input
            type="checkbox"
            name="attestation"
            className="mt-0.5 size-5 shrink-0 accent-[var(--w-leaf)]"
          />
          <span className="text-sm leading-6 text-foreground">
            I confirm this list isn&apos;t bought, scraped or third-party, and I
            have a lawful basis to email everyone on it.
          </span>
        </label>
        {attestationError ? (
          <FormMessage>{attestationError}</FormMessage>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton name="intent" value="send" pendingLabel="Sending…">
          Send {preview.eligible.toLocaleString("en-GB")} invitation
          {preview.eligible === 1 ? "" : "s"}
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="preview"
          variant="secondary"
          pendingLabel="Checking…"
        >
          Re-check list
        </SubmitButton>
      </div>
    </div>
  )
}

function CampaignStatusCard({
  campaign,
  action,
  formError,
}: {
  campaign: LoyaltyInviteCampaignSummary
  action: (formData: FormData) => void
  formError?: string
}) {
  const counts = campaign.statusCounts
  const isCompleted = campaign.status === "completed"
  const sent =
    (counts.sent ?? 0) +
    (counts.delivered ?? 0) +
    (counts.opened ?? 0) +
    (counts.joined ?? 0)
  const joined = counts.joined ?? 0
  const queued = (counts.queued ?? 0) + (counts.sending ?? 0)

  return (
    <div className="grid min-w-0 gap-5 rounded-lg border-2 border-ink bg-card p-4 shadow-[var(--shadow-hard)] sm:p-6">
      {formError ? (
        <StatusBanner tone="error" title="Something went wrong.">
          {formError}
        </StatusBanner>
      ) : null}

      <SectionHeader
        eyebrow={isCompleted ? "Invitations sent" : "Campaign in progress"}
        title={
          isCompleted
            ? "Your invitations are on their way"
            : "Sending your invitations"
        }
        actions={
          <MonoTag tone={isCompleted ? "leaf" : "cobalt"}>
            {isCompleted ? "Completed" : "Sending"}
          </MonoTag>
        }
      />

      <ProgressTrack
        current={sent}
        total={campaign.eligibleCount}
        label="Sent"
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CampaignStat label="Eligible" value={campaign.eligibleCount} />
        <CampaignStat label="Sent" value={sent} />
        <CampaignStat label="Awaiting send" value={queued} />
        <CampaignStat label="Joined" value={joined} tone="reward" />
      </dl>

      <p className="text-sm leading-6 text-muted-foreground">
        {isCompleted
          ? "All invitations have been sent. Their links stay active until they expire. Cancelling invalidates any that haven't been claimed; emails already sent can't be recalled."
          : "Invitations are sent gradually. Cancelling stops any that haven't sent and invalidates unclaimed links; emails already sent can't be recalled."}
      </p>

      <form action={action}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <SubmitButton
          name="intent"
          value="cancel"
          variant="secondary"
          pendingLabel="Cancelling…"
        >
          {isCompleted ? "Cancel remaining links" : "Cancel campaign"}
        </SubmitButton>
      </form>
    </div>
  )
}

function CampaignStat({
  label,
  value,
  tone = "ink",
}: {
  label: string
  value: number
  tone?: "ink" | "reward"
}) {
  return (
    <div className="grid gap-1 rounded-lg border-2 border-border bg-secondary/40 p-3">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "numeric-tabular text-2xl leading-none font-extrabold",
          tone === "reward" ? "text-reward" : "text-foreground"
        )}
      >
        {value.toLocaleString("en-GB")}
      </dd>
    </div>
  )
}

/**
 * The confirmation used to be terminal: an icon, "Done." and the message, with
 * no link, no button and no way back to Members or to a second batch short of
 * a browser back or a nav tap. It now ends on the merchant's two natural next
 * actions.
 */
function SentConfirmation({ message }: { message: string }) {
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-5 rounded-lg border-2 border-ink bg-card p-6 text-center shadow-[var(--shadow-hard)] sm:p-8">
      <span className="grid size-12 place-items-center rounded-full border-2 border-ink bg-reward/15 text-reward">
        <Icon icon={CheckmarkCircle02Icon} size={26} strokeWidth={2.25} />
      </span>
      <div className="grid gap-2">
        <Eyebrow>Invitations queued</Eyebrow>
        <h2 className="text-2xl font-extrabold text-foreground">Done.</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/app/customers" prefetch={false}>
            Back to members
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app/customers/invite" prefetch={false}>
            Send another batch
          </Link>
        </Button>
      </div>
    </div>
  )
}
