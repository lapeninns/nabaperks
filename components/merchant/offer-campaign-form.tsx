"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { CheckmarkCircle02Icon, LockKeyIcon } from "@hugeicons/core-free-icons"

import {
  offerCampaignFormAction,
  type OfferCampaignState,
  type OfferCreatorStep,
} from "@/app/app/offers/actions"
import { Eyebrow, Icon, SectionHeader } from "@/components/brand"
import { FormMessage, SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import {
  Field,
  TextareaField,
} from "@/components/merchant/merchant-form-fields"
import {
  OFFER_BENEFIT_PRESETS,
  OfferBenefitPreview,
} from "@/components/merchant/offers/offer-benefit-preview"
import {
  OfferRulesSummary,
  formatOfferDate,
} from "@/components/merchant/offers/offer-rules-summary"
import { Button } from "@/components/ui/button"
import { addUkCalendarDays } from "@/lib/customer/uk-calendar"
import { OFFERS_HOME_PATH, OFFERS_NEW_PATH } from "@/lib/merchant/offer-nav"
import { OFFER_NO_STACKING_TERM } from "@/lib/merchant/offer-campaign-fields"
import {
  OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH,
  OFFER_CAMPAIGN_NAME_MAX_LENGTH,
  OFFER_EXTRA_TERMS_MAX_LENGTH,
  maxBonusStampCount,
  offerBenefitRequires,
} from "@/lib/offers/campaign-core"
import {
  OFFER_CAMPAIGN_MAX_DURATION_DAYS,
  OFFER_DISCOUNT_PERCENT_MAX,
  OFFER_DISCOUNT_PERCENT_MIN,
  isOfferBenefitKind,
  type OfferBenefitKind,
} from "@/lib/offers/constants"
import { cn } from "@/lib/utils"

/**
 * The three-step "Create an offer" desk, driven by one `useActionState`.
 *
 * Steps one and two are client-side because nothing has been written yet — the
 * merchant is still choosing. Step three exists only after the server has
 * created the draft, so the review is a readback of a real row rather than of
 * the boxes on screen: `state.fields` is what the server received and
 * `state.campaignId` is what it created.
 *
 * Publishing is the point of no return. The database freezes the benefit, the
 * dates, the ID rule and the terms the moment a campaign leaves 'draft', so this
 * form offers no edit path afterwards — the management panel can only pause,
 * resume, rotate the link or end the campaign.
 */

const STEP_LABELS: ReadonlyArray<{ step: OfferCreatorStep; label: string }> = [
  { step: "benefits", label: "Choose benefits" },
  { step: "rules", label: "Set the rules" },
  { step: "review", label: "Review and publish" },
]

const INITIAL_STATE: OfferCampaignState = { step: "benefits" }

export type OfferCampaignFormProps = {
  readonly merchantName: string
  /** The venue's active card length; bounds the welcome-stamp field. */
  readonly stampsRequired: number
  readonly rewardName: string | null
  /** Today's UK date as `YYYY-MM-DD` — the earliest a campaign may open. */
  readonly today: string
  /** The latest end date the 366-day window allows from today. */
  readonly latestEndDate: string
  readonly initialStep: OfferCreatorStep
  /**
   * Seeds `useActionState` so a DB-free harness can render the rules and review
   * steps. Production never sets it.
   */
  readonly seedState?: OfferCampaignState
}

export function OfferCampaignForm({
  merchantName,
  stampsRequired,
  rewardName,
  today,
  latestEndDate,
  initialStep,
  seedState = INITIAL_STATE,
}: OfferCampaignFormProps) {
  const [state, action] = useActionState(offerCampaignFormAction, seedState)
  const [step, setStep] = useState<OfferCreatorStep>(initialStep)
  const [dismissedDraftId, setDismissedDraftId] = useState<string | null>(null)
  const [benefitKind, setBenefitKind] = useState<OfferBenefitKind>(
    seededBenefitKind(seedState)
  )

  // Which step to show is derived, never synchronised: a draft the merchant has
  // not stepped back from IS the review, so a successful save lands on it
  // without an effect chasing the action state. Stepping back records the draft
  // id as dismissed, and the next save mints a new draft — a new id — which
  // brings the review back.
  const draftId = state.campaignId ?? null
  const reviewing = draftId !== null && draftId !== dismissedDraftId
  const currentStep: OfferCreatorStep = reviewing
    ? "review"
    : step === "review"
      ? "rules"
      : step

  // Keep the address bar honest so a refresh, a bookmark or the back button all
  // land on the step the merchant is looking at. The URL is an external system,
  // not React state, so this belongs in an effect.
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      `${OFFERS_NEW_PATH}?step=${currentStep}`
    )
  }, [currentStep])

  const stampCeiling = maxBonusStampCount(stampsRequired)
  const requires = offerBenefitRequires(benefitKind)

  return (
    <div className="grid min-w-0 gap-5">
      <StepTrack current={currentStep} />

      {state.errors?.form ? (
        <StatusBanner tone="error" title="That didn't work.">
          {state.errors.form}
        </StatusBanner>
      ) : null}

      {reviewing ? (
        <ReviewStep
          action={action}
          state={state}
          merchantName={merchantName}
          stampsRequired={stampsRequired}
          rewardName={rewardName}
          today={today}
          onBack={() => {
            setDismissedDraftId(draftId)
            setStep("rules")
          }}
        />
      ) : (
        <form action={action} className="grid min-w-0 gap-5">
          <input type="hidden" name="intent" value="draft" />

          <fieldset
            hidden={currentStep !== "benefits"}
            className="grid min-w-0 gap-5 rounded-lg border border-border bg-card p-4 sm:p-6"
          >
            <BenefitStep
              benefitKind={benefitKind}
              onChange={setBenefitKind}
              stampCeiling={stampCeiling}
              error={state.errors?.benefitKind}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setStep("rules")}>
                Continue
              </Button>
              <Button asChild variant="ghost">
                <Link href={OFFERS_HOME_PATH}>Cancel</Link>
              </Button>
            </div>
          </fieldset>

          <fieldset
            hidden={currentStep !== "rules"}
            className="grid min-w-0 gap-5 rounded-lg border border-border bg-card p-4 sm:p-6"
          >
            <RulesStep
              state={state}
              requires={requires}
              stampCeiling={stampCeiling}
              today={today}
              latestEndDate={latestEndDate}
            />
            <div className="flex flex-wrap gap-3">
              <SubmitButton pendingLabel="Saving…">
                Save and review
              </SubmitButton>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("benefits")}
              >
                Back
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  )
}

function seededBenefitKind(seedState: OfferCampaignState): OfferBenefitKind {
  const seeded = seedState.fields?.benefitKind
  return isOfferBenefitKind(seeded) ? seeded : "bonus_stamps"
}

// ─── Step one: benefits ───────────────────────────────────────────────────────

function BenefitStep({
  benefitKind,
  onChange,
  stampCeiling,
  error,
}: {
  benefitKind: OfferBenefitKind
  onChange: (kind: OfferBenefitKind) => void
  stampCeiling: number
  error?: string
}) {
  return (
    <div className="grid gap-4">
      <SectionHeader
        eyebrow="Step 1"
        title="What does this offer give?"
        description="Pick one. You can end the offer at any time, but the benefit is fixed once you publish."
      />

      <div className="grid gap-2" role="radiogroup" aria-label="Offer benefit">
        {OFFER_BENEFIT_PRESETS.map((preset) => {
          const needsStamps = preset.kind !== "discount"
          const unavailable = needsStamps && stampCeiling < 1

          return (
            <label
              key={preset.kind}
              className={cn(
                "focus-ring-within flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-border bg-card p-3 transition-[border-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] has-checked:border-ink motion-reduce:transition-none",
                unavailable && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name="benefitKind"
                value={preset.kind}
                checked={benefitKind === preset.kind}
                disabled={unavailable}
                onChange={() => onChange(preset.kind)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--w-ink)]"
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {preset.title}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {unavailable
                    ? "Your card is too short to give welcome stamps — lengthen the card or choose the discount pass."
                    : preset.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  )
}

// ─── Step two: rules ──────────────────────────────────────────────────────────

function RulesStep({
  state,
  requires,
  stampCeiling,
  today,
  latestEndDate,
}: {
  state: OfferCampaignState
  requires: { readonly bonusStamps: boolean; readonly discount: boolean }
  stampCeiling: number
  today: string
  latestEndDate: string
}) {
  const fields = state.fields
  const errors = state.errors
  const [startsOn, setStartsOn] = useState(fields?.startsOn || today)
  const endDateMax = startsOn
    ? addUkCalendarDays(startsOn, OFFER_CAMPAIGN_MAX_DURATION_DAYS - 1)
    : latestEndDate

  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Step 2"
        title="Set the rules"
        description="These are the terms a customer is promised. They are locked as soon as you publish."
      />

      <Field
        id="name"
        name="name"
        label="Offer name"
        maxLength={OFFER_CAMPAIGN_NAME_MAX_LENGTH}
        defaultValue={fields?.name}
        hint={`How you and your customers refer to this offer, up to ${OFFER_CAMPAIGN_NAME_MAX_LENGTH} characters. For example, "Summer welcome".`}
        error={errors?.name}
      />

      <TextareaField
        id="customerDescription"
        name="customerDescription"
        label="What customers read"
        rows={2}
        maxLength={OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH}
        defaultValue={fields?.customerDescription}
        hint={`One short line shown on the page a customer lands on, up to ${OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters.`}
        error={errors?.customerDescription}
      />

      {requires.bonusStamps ? (
        <Field
          id="bonusStampCount"
          name="bonusStampCount"
          label="Welcome stamps"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(stampCeiling, 1)}
          defaultValue={fields?.bonusStampCount || "2"}
          hint={`Between 1 and ${stampCeiling}. Welcome stamps can never complete a card on their own.`}
          error={errors?.bonusStampCount}
        />
      ) : null}

      {requires.discount ? (
        <Field
          id="discountPercent"
          name="discountPercent"
          label="Discount off the whole bill"
          type="number"
          inputMode="numeric"
          min={OFFER_DISCOUNT_PERCENT_MIN}
          max={OFFER_DISCOUNT_PERCENT_MAX}
          defaultValue={fields?.discountPercent || "10"}
          hint={`Between ${OFFER_DISCOUNT_PERCENT_MIN}% and ${OFFER_DISCOUNT_PERCENT_MAX}%. The pass can be used as often as the customer likes while the offer runs.`}
          error={errors?.discountPercent}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="startsOn"
          name="startsOn"
          label="Opens"
          type="date"
          min={today}
          max={latestEndDate}
          defaultValue={fields?.startsOn || today}
          onChange={(event) => setStartsOn(event.currentTarget.value)}
          hint="Publish ahead of this date and the offer waits, scheduled."
          error={errors?.startsOn}
        />
        <Field
          id="endsOn"
          name="endsOn"
          label="Closes"
          type="date"
          min={today}
          max={endDateMax}
          defaultValue={fields?.endsOn || ""}
          hint="An offer can run for at most 366 days."
          error={errors?.endsOn}
        />
      </div>

      <label className="focus-ring-within flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-border bg-card p-3 transition-[border-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] has-checked:border-ink motion-reduce:transition-none">
        <input
          type="checkbox"
          name="requiresIdCheck"
          defaultChecked={fields?.requiresIdCheck === true}
          className="mt-0.5 size-4 shrink-0 accent-[var(--w-leaf)]"
        />
        <span className="grid min-w-0 gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            Ask staff to check photo ID
          </span>
          <span className="text-xs leading-5 text-muted-foreground">
            Staff confirm they checked it each time they honour the pass. No ID
            details are ever recorded.
          </span>
        </span>
      </label>

      <TextareaField
        id="extraTerms"
        name="extraTerms"
        label="Additional terms (optional)"
        rows={3}
        maxLength={OFFER_EXTRA_TERMS_MAX_LENGTH}
        defaultValue={fields?.extraTerms}
        hint={`Anything else a customer should know, up to ${OFFER_EXTRA_TERMS_MAX_LENGTH} characters.`}
        error={errors?.extraTerms}
      />

      <div className="grid gap-1.5 rounded-lg border-[1.5px] border-dashed border-border bg-secondary/40 p-3">
        <span className="flex items-center gap-2">
          <Icon icon={LockKeyIcon} size={14} strokeWidth={2.25} />
          <Eyebrow>Always included</Eyebrow>
        </span>
        <p className="text-sm leading-6 text-foreground">
          {OFFER_NO_STACKING_TERM}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Every offer carries this rule and staff confirm it on each redemption.
          It cannot be edited or removed.
        </p>
      </div>
    </div>
  )
}

// ─── Step three: review and publish ───────────────────────────────────────────

function ReviewStep({
  action,
  state,
  merchantName,
  stampsRequired,
  rewardName,
  today,
  onBack,
}: {
  action: (formData: FormData) => void
  state: OfferCampaignState
  merchantName: string
  stampsRequired: number
  rewardName: string | null
  today: string
  onBack: () => void
}) {
  const fields = state.fields
  const bonusStampCount = wholeNumber(fields?.bonusStampCount)
  const discountPercent = wholeNumber(fields?.discountPercent)
  const startsOn = fields?.startsOn ?? null
  const endsOn = fields?.endsOn ?? null
  const requiresIdCheck = fields?.requiresIdCheck === true
  const extraTerms = fields?.extraTerms?.trim() || null
  const name = fields?.name?.trim() || null
  const customerDescription = fields?.customerDescription?.trim() || null
  const startsLater = Boolean(startsOn && startsOn > today)

  return (
    <div className="grid min-w-0 gap-5">
      {state.message ? (
        <StatusBanner tone="success" title="Offer saved">
          {state.message}
        </StatusBanner>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <div className="grid min-w-0 gap-5 rounded-lg border border-border bg-card p-4 sm:p-6">
          <SectionHeader
            eyebrow="Step 3"
            title="Review and publish"
            description="Check the promise you are about to make. Once published, none of it can be changed."
          />

          <OfferRulesSummary
            name={name}
            customerDescription={customerDescription}
            bonusStampCount={bonusStampCount}
            discountPercent={discountPercent}
            startsOn={startsOn}
            endsOn={endsOn}
            requiresIdCheck={requiresIdCheck}
            extraTerms={extraTerms}
            stampsRequired={stampsRequired}
          />

          <StatusBanner tone="info" title="The link is the eligibility">
            Anyone who opens your confidential link can claim this offer, so
            treat it like the key to the offer itself. Print it on your poster,
            put it where you want it seen, and rotate it if it goes somewhere it
            shouldn&apos;t.
          </StatusBanner>

          <StatusBanner tone="neutral" title="New members only">
            Customers who already hold a digital loyalty card with you cannot
            claim this offer. They are told so plainly and are sent to their
            existing card instead.
          </StatusBanner>

          <form action={action} className="grid gap-4">
            <input type="hidden" name="intent" value="publish" />
            <input
              type="hidden"
              name="campaignId"
              value={state.campaignId ?? ""}
            />

            <label className="focus-ring-within flex cursor-pointer items-start gap-3 rounded-lg border-2 border-ink bg-secondary/40 p-3">
              {/* The value is checked server-side on every publish, so this
                  box is the confirmation rather than a picture of one. */}
              <input
                type="checkbox"
                name="acknowledgement"
                value="terms-locked"
                required
                className="mt-0.5 size-4 shrink-0 accent-[var(--w-leaf)]"
              />
              <span className="text-sm leading-6 text-foreground">
                I understand these terms are locked once published, and that
                only customers who are not already members can claim.
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <SubmitButton
                variant="reward"
                pendingLabel={startsLater ? "Scheduling…" : "Publishing…"}
              >
                <Icon icon={CheckmarkCircle02Icon} size={16} />
                {startsLater
                  ? `Schedule for ${formatOfferDate(startsOn)}`
                  : "Publish now"}
              </SubmitButton>
              <Button type="button" variant="secondary" onClick={onBack}>
                Back to the rules
              </Button>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              {startsLater
                ? "The offer waits until its opening date, then starts accepting claims on its own."
                : "The offer starts accepting claims as soon as you publish."}
            </p>
          </form>
        </div>

        {/* Not sticky: the preview is now the customer's whole landing page —
            promise, stamp row and discount pass — so pinning it to the top of
            the viewport would put its lower half out of reach on a laptop. */}
        <div className="min-w-0">
          <OfferBenefitPreview
            venueName={merchantName}
            campaignName={name}
            customerDescription={customerDescription}
            bonusStampCount={bonusStampCount}
            discountPercent={discountPercent}
            requiresIdCheck={requiresIdCheck}
            extraTerms={extraTerms}
            startsOn={startsOn}
            endsOn={endsOn}
            stampsRequired={stampsRequired}
            rewardName={rewardName}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step track ───────────────────────────────────────────────────────────────

function StepTrack({ current }: { current: OfferCreatorStep }) {
  const currentIndex = STEP_LABELS.findIndex((entry) => entry.step === current)

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STEP_LABELS.map((entry, index) => (
        <li key={entry.step} className="flex items-center gap-2">
          <span
            aria-current={index === currentIndex ? "step" : undefined}
            className={cn(
              "mono-meta rounded-full border-[1.5px] px-2.5 py-1",
              index === currentIndex
                ? "border-ink bg-ink text-paper"
                : index < currentIndex
                  ? "border-ink bg-reward/15 text-foreground"
                  : "border-border text-muted-foreground"
            )}
          >
            {index + 1}. {entry.label}
          </span>
          {index < STEP_LABELS.length - 1 ? (
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function wholeNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null
  const parsed = Number(raw.trim())
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
