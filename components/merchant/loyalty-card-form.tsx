"use client"

import { useActionState, useState } from "react"
import {
  MinusSignIcon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  saveLoyaltyCardAction,
  type LoyaltyCardActionState,
} from "@/app/app/card/actions"
import { Icon } from "@/components/brand"
import { CustomerCardPreview } from "@/components/merchant/launch/customer-card-preview"
import { FormActionBar } from "@/components/merchant/launch/form-action-bar"
import {
  Field,
  TextareaField,
  ToggleRow,
} from "@/components/merchant/merchant-form-fields"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/forms"
import {
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"
import {
  defaultLoyaltyCardRewardTerms,
  isDefaultLoyaltyCardRewardTerms,
} from "@/lib/merchant/loyalty-card-copy"
import type { CardCadencePreset } from "@/lib/merchant/reward-presets"
import {
  REWARD_EXPIRY_OPTIONS,
  rewardExpiryLabel,
} from "@/lib/merchant/reward-expiry-fields"
import { cn } from "@/lib/utils"

type LoyaltyCardFormValues = {
  cardId?: string
  cardName: string
  stampsRequired: string
  rewardTerms: string
  rewardExpiryDays: string
  isActive: boolean
}

type LoyaltyCardFormProps = {
  initialValues: LoyaltyCardFormValues
  merchantName: string
  activeRewardCount?: number
  cadencePresets?: readonly CardCadencePreset[]
}

const initialCardState: LoyaltyCardActionState = {}

export function LoyaltyCardForm({
  initialValues,
  merchantName,
  activeRewardCount = 0,
  cadencePresets = [],
}: LoyaltyCardFormProps) {
  const [state, action, pending] = useActionState(
    saveLoyaltyCardAction,
    initialCardState
  )
  const [draft, setDraft] = useState(initialValues)

  function updateDraft<K extends keyof LoyaltyCardFormValues>(
    field: K,
    value: LoyaltyCardFormValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  function updateStampsRequired(value: string) {
    const parsed = Number.parseInt(value, 10)

    setDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, stampsRequired: value }

      if (
        Number.isFinite(parsed) &&
        isDefaultLoyaltyCardRewardTerms(currentDraft.rewardTerms)
      ) {
        nextDraft.rewardTerms = defaultLoyaltyCardRewardTerms(parsed)
      }

      return nextDraft
    })
  }

  // Dirty state drives the action bar's left slot, so the merchant can tell a
  // saved card from an edited one without scrolling back up the form.
  const dirty =
    draft.cardName !== initialValues.cardName ||
    draft.stampsRequired !== initialValues.stampsRequired ||
    draft.rewardTerms !== initialValues.rewardTerms ||
    draft.rewardExpiryDays !== initialValues.rewardExpiryDays ||
    draft.isActive !== initialValues.isActive

  const selectedCadencePreset = cadencePresets.find(
    (preset) => String(preset.stampsRequired) === draft.stampsRequired
  )
  const cadenceHint =
    selectedCadencePreset?.description ??
    `Choose ${MIN_STAMPS_REQUIRED}–${MAX_STAMPS_REQUIRED} visits. Stamps needed before the reward unseals.`

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
      <form
        action={action}
        className="surface-card order-1 grid min-w-0 gap-3 p-3 sm:gap-5 sm:p-6 lg:order-none"
      >
        <input type="hidden" name="cardId" value={draft.cardId ?? ""} />
        <input
          type="hidden"
          name="stampsRequired"
          value={draft.stampsRequired}
        />

        <SectionHead
          title="Your card"
          description={`One active card for ${merchantName}. The reward reveals after the final qualifying visit.`}
          compactOnMobile
        />

        <Field
          id="cardName"
          label="Card name"
          name="cardName"
          maxLength={80}
          value={draft.cardName}
          onChange={(event) => updateDraft("cardName", event.target.value)}
          error={state.errors?.cardName}
        />

        {/* One value, one hierarchy: the three cadences lead (the count IS the
            decision, so it is the numeral), and the stepper is the demoted
            "custom number" row beneath them rather than a second, unlinked
            control of equal weight. Selection is a 2px ink border + a check —
            the old inverted ink fill outweighed the submit button below it. */}
        <div className="grid gap-2">
          <span className="eyebrow">Visits to reveal</span>
          {cadencePresets.length > 0 ? (
            <div
              aria-label="Visit cadence presets"
              className="grid gap-2 sm:grid-cols-3"
            >
              {cadencePresets.map((preset) => {
                const selected =
                  String(preset.stampsRequired) === draft.stampsRequired

                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      updateStampsRequired(String(preset.stampsRequired))
                    }
                    className={cn(
                      "focus-ring grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-lg border-2 px-3 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                      selected
                        ? "border-ink bg-secondary text-foreground shadow-sm"
                        : "border-border bg-card text-foreground hover:border-ink"
                    )}
                  >
                    <span className="numeric-tabular font-mono text-2xl leading-none font-bold">
                      {preset.stampsRequired}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm leading-snug font-extrabold text-pretty">
                        {preset.label}
                        {selected ? (
                          <Icon
                            icon={Tick02Icon}
                            size={16}
                            strokeWidth={2.5}
                            className="shrink-0"
                          />
                        ) : null}
                      </span>
                      <span className="mono-id leading-none text-muted-foreground">
                        {preset.stampsRequired} visits
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span
              id="stamps-required-custom"
              className="text-xs leading-5 text-muted-foreground"
            >
              Or set a custom number
            </span>
            <Stepper
              label="Visits to reveal"
              describedBy="stamps-required-custom"
              value={draft.stampsRequired}
              min={MIN_STAMPS_REQUIRED}
              max={MAX_STAMPS_REQUIRED}
              onChange={updateStampsRequired}
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {cadenceHint}
          </p>
          {state.errors?.stampsRequired ? (
            <p className="text-sm text-destructive">
              {state.errors.stampsRequired}
            </p>
          ) : null}
        </div>

        <TextareaField
          id="rewardTerms"
          label="Reward terms"
          name="rewardTerms"
          rows={2}
          value={draft.rewardTerms}
          onChange={(event) => updateDraft("rewardTerms", event.target.value)}
          hint="Shown on the member card. The suggested copy updates when you change visits, until you edit this field."
          error={state.errors?.rewardTerms}
        />

        <div className="space-y-2">
          <label
            htmlFor="rewardExpiryDays"
            className="text-sm font-medium text-foreground"
          >
            Reward stays claimable for
          </label>
          <SelectField
            id="rewardExpiryDays"
            name="rewardExpiryDays"
            value={draft.rewardExpiryDays}
            onChange={(event) =>
              updateDraft("rewardExpiryDays", event.target.value)
            }
          >
            {REWARD_EXPIRY_OPTIONS.map((days) => (
              <option key={days} value={String(days)}>
                {rewardExpiryLabel(days)}
              </option>
            ))}
          </SelectField>
          <p className="text-xs leading-5 text-muted-foreground">
            After this, an uncollected reward lapses and the member starts a
            fresh card. Without it a full card would stop collecting for good.
          </p>
          {state.errors?.rewardExpiryDays ? (
            <p className="text-sm text-destructive">
              {state.errors.rewardExpiryDays}
            </p>
          ) : null}
        </div>

        <ToggleRow
          name="isActive"
          label="Card is active"
          hint="Members can collect stamps on this card."
          checked={draft.isActive}
          onChange={(checked) => updateDraft("isActive", checked)}
        />

        {state.errors?.form ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}

        <FormActionBar
          className="-mx-3 px-3 sm:px-0"
          hint={dirty ? "Unsaved changes" : undefined}
        >
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : draft.cardId ? "Save card" : "Create card"}
          </Button>
        </FormActionBar>
      </form>

      <CustomerCardPreview
        className="order-last lg:order-none"
        merchantName={merchantName}
        draft={draft}
        activeRewardCount={activeRewardCount}
      />
    </div>
  )
}

function SectionHead({
  title,
  description,
  compactOnMobile = false,
}: {
  title: string
  description: string
  compactOnMobile?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 sm:gap-4">
      <div className="grid gap-1 sm:gap-2">
        <h2 className="text-lg leading-snug font-extrabold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
        <p
          className={cn(
            "max-w-[44ch] text-sm leading-6 text-muted-foreground",
            compactOnMobile && "hidden sm:block"
          )}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  describedBy,
}: {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  label: string
  /** Links the group to the "or set a custom number" line beside it. */
  describedBy?: string
}) {
  const parsed = Number.parseInt(value, 10)
  const current = Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : min
  const atMin = current <= min
  const atMax = current >= max

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="inline-flex w-max items-stretch overflow-hidden rounded-lg border-2 border-border bg-secondary"
    >
      <button
        type="button"
        aria-label="Fewer visits"
        disabled={atMin}
        onClick={() => onChange(String(Math.max(min, current - 1)))}
        className="focus-ring grid min-h-9 w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
      >
        <Icon icon={MinusSignIcon} size={18} strokeWidth={2.25} />
      </button>
      <span
        aria-live="polite"
        className="numeric-tabular grid min-w-[3.25rem] place-items-center border-x-2 border-border bg-card font-mono text-base font-bold text-foreground"
      >
        {current}
      </span>
      <button
        type="button"
        aria-label="More visits"
        disabled={atMax}
        onClick={() => onChange(String(Math.min(max, current + 1)))}
        className="focus-ring grid min-h-9 w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
      >
        <Icon icon={PlusSignIcon} size={18} strokeWidth={2.25} />
      </button>
    </div>
  )
}

export {
  Field,
  TextareaField,
  ToggleRow,
} from "@/components/merchant/merchant-form-fields"
export { RewardPoolForm } from "@/components/merchant/reward-pool-form"
export type { RewardPoolItemValues } from "@/components/merchant/reward-pool-form"
