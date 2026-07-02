"use client"

import Link from "next/link"
import { useActionState, useOptimistic, useState, useTransition } from "react"
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  GiftIcon,
  MinusSignIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"

import {
  deleteRewardPoolItemAction,
  saveLoyaltyCardAction,
  saveRewardPoolItemAction,
  toggleRewardPoolItemActiveAction,
  type LoyaltyCardActionState,
  type RewardPoolItemActionState,
} from "@/app/app/card/actions"
import {
  EmptyState,
  Eyebrow,
  Icon,
  MonoTag,
} from "@/components/brand"
import { CustomerCardPreview } from "@/components/merchant/launch/customer-card-preview"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { Button } from "@/components/ui/button"
import {
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"
import {
  defaultLoyaltyCardRewardTerms,
  isDefaultLoyaltyCardRewardTerms,
} from "@/lib/merchant/loyalty-card-copy"
import {
  rewardPresetToPoolItemValues,
  type CardCadencePreset,
  type RewardPreset,
} from "@/lib/merchant/reward-presets"
import { cn } from "@/lib/utils"

type LoyaltyCardFormValues = {
  cardId?: string
  cardName: string
  stampsRequired: string
  rewardTerms: string
  isActive: boolean
}

export type RewardPoolItemValues = {
  id?: string
  rewardName: string
  rewardTerms: string
  weight: string
  displayOrder: string
  isActive: boolean
}

type LoyaltyCardFormProps = {
  initialValues: LoyaltyCardFormValues
  merchantName: string
  locationName: string
  /** Active pool count — shown in the customer preview sidebar. */
  activeRewardCount?: number
  cadencePresets?: readonly CardCadencePreset[]
}

/** Rewards needed active before a final stamp can reveal a prize or the QR launches. */
const REQUIRED_ACTIVE_REWARDS = 3

const initialCardState: LoyaltyCardActionState = {}
const initialPoolState: RewardPoolItemActionState = {}

export function LoyaltyCardForm({
  initialValues,
  merchantName,
  locationName,
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
      const nextDraft: LoyaltyCardFormValues = {
        ...currentDraft,
        stampsRequired: value,
      }

      if (
        Number.isFinite(parsed) &&
        isDefaultLoyaltyCardRewardTerms(currentDraft.rewardTerms)
      ) {
        nextDraft.rewardTerms = defaultLoyaltyCardRewardTerms(parsed)
      }

      return nextDraft
    })
  }

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
        className="order-1 grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 sm:gap-5 sm:p-6 lg:order-none"
      >
        <input type="hidden" name="cardId" value={draft.cardId ?? ""} />
        <input
          type="hidden"
          name="stampsRequired"
          value={draft.stampsRequired}
        />

        <SectionHead
          title="Your card"
          description={`One active card for ${locationName}. The reward reveals after the final qualifying visit.`}
          step="Step 1"
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

        <div className="grid gap-2">
          <span className="text-sm font-bold text-foreground">
            Visits to reveal
          </span>
          <Stepper
            label="Visits to reveal"
            value={draft.stampsRequired}
            min={MIN_STAMPS_REQUIRED}
            max={MAX_STAMPS_REQUIRED}
            onChange={updateStampsRequired}
          />
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
                      "grid min-h-16 min-w-0 gap-1 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none",
                      selected
                        ? "border-ink bg-ink text-paper shadow-sm"
                        : "border-border bg-secondary text-foreground hover:border-ink"
                    )}
                  >
                    <span className="text-sm leading-snug font-extrabold text-pretty">
                      {preset.label}
                    </span>
                    <span className="mono-id leading-none">
                      {preset.stampsRequired} visits
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">{cadenceHint}</p>
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
          hintClassName="hidden sm:block"
          error={state.errors?.rewardTerms}
        />

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

        <div className="sticky bottom-3 z-10 border-t border-border/80 bg-card/95 pt-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:pt-0 sm:backdrop-blur-none">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving..." : draft.cardId ? "Save card" : "Create card"}
          </Button>
        </div>
      </form>

      <CustomerCardPreview
        className="order-last lg:order-none"
        merchantName={merchantName}
        locationName={locationName}
        draft={draft}
        activeRewardCount={activeRewardCount}
      />
    </div>
  )
}

export function RewardPoolForm({
  loyaltyCardId,
  cardName,
  rewardPoolItems,
  continueHref,
  continueLabel = "your venue QR",
  presets = [],
}: RewardPoolFormProps) {
  // The row currently open in the inline editor: a reward id, "new", or null.
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [newRewardValues, setNewRewardValues] = useState<RewardPoolItemValues>(
    buildBlankRewardValues(rewardPoolItems.length + 1)
  )
  const [newRewardKey, setNewRewardKey] = useState("blank")

  const activeRewardCount = rewardPoolItems.filter(
    (item) => item.isActive
  ).length
  const ready = activeRewardCount >= REQUIRED_ACTIVE_REWARDS
  const deficit = REQUIRED_ACTIVE_REWARDS - activeRewardCount

  function openBlankReward() {
    setNewRewardValues(buildBlankRewardValues(rewardPoolItems.length + 1))
    setNewRewardKey(`blank-${rewardPoolItems.length + 1}`)
    setEditingId("new")
  }

  function openPresetReward(preset: RewardPreset) {
    setNewRewardValues(
      rewardPresetToPoolItemValues(preset, rewardPoolItems.length + 1)
    )
    setNewRewardKey(preset.id)
    setEditingId("new")
  }

  return (
    <section className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-3 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-2">
          <h2 className="text-lg leading-snug font-extrabold tracking-tight text-foreground sm:text-xl">
            Reward pool
          </h2>
          <p className="max-w-[44ch] text-sm leading-6 text-pretty text-muted-foreground">
            The surprise is drawn from this pool. At least 3 must be active on{" "}
            {cardName} before you can launch.
          </p>
        </div>
        {/* The live counter replaces the old blocking banner. */}
        <MonoTag tone={ready ? "leaf" : "sun"}>
          {ready
            ? `${activeRewardCount} active · ready`
            : `${activeRewardCount} / ${REQUIRED_ACTIVE_REWARDS} active`}
        </MonoTag>
      </div>

      <p className="text-sm leading-5 text-muted-foreground">
        {ready ? (
          <>
            Each reward saves when you add or edit it. Continue below when you
            are happy with the pool.
          </>
        ) : (
          <>
            Activate <b className="font-bold text-foreground">{deficit} more</b>{" "}
            reward{deficit === 1 ? "" : "s"} to unlock launch.
          </>
        )}
      </p>

      {presets.length > 0 ? (
        <div className="grid gap-2 rounded-lg bg-secondary p-3">
          <Eyebrow>Pub reward presets</Eyebrow>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => openPresetReward(preset)}
                className="grid min-h-16 min-w-0 gap-1 rounded-lg border-[1.5px] border-border bg-card px-3 py-2.5 text-left text-foreground transition-[background-color,border-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
              >
                <span className="text-sm leading-snug font-extrabold text-pretty">
                  {preset.rewardName}
                </span>
                <span className="text-xs leading-4 text-pretty text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rewardPoolItems.length === 0 && editingId !== "new" ? (
        <EmptyState
          icon={GiftIcon}
          title="No rewards in the pool yet"
          description="Add at least 3 active mystery rewards so the final stamp can reveal a prize."
          headingLevel={3}
        />
      ) : null}

      <div className="grid gap-2">
        {rewardPoolItems.map((item) =>
          editingId === item.id ? (
            <RewardPoolItemForm
              key={item.id}
              loyaltyCardId={loyaltyCardId}
              initialValues={item}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <RewardRow
              key={item.id}
              item={item}
              loyaltyCardId={loyaltyCardId}
              onEdit={() => setEditingId(item.id ?? null)}
            />
          )
        )}

        {editingId === "new" ? (
          <RewardPoolItemForm
            key={`new-${newRewardKey}`}
            loyaltyCardId={loyaltyCardId}
            initialValues={newRewardValues}
            isNew
            onCancel={() => setEditingId(null)}
          />
        ) : null}
      </div>

      {editingId !== "new" ? (
        <button
          type="button"
          onClick={openBlankReward}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-transparent px-4 py-3 text-sm font-bold text-foreground transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
        >
          <Icon icon={Add01Icon} size={16} strokeWidth={2.25} />
          Add a reward
        </button>
      ) : null}

      {ready && editingId === null && continueHref ? (
        <Button asChild className="w-full">
          <Link href={continueHref}>
            {continueHref.includes("billing")
              ? "Proceed to billing"
              : `Continue to ${continueLabel}`}
          </Link>
        </Button>
      ) : null}
    </section>
  )
}

type RewardPoolFormProps = {
  loyaltyCardId: string
  cardName: string
  rewardPoolItems: RewardPoolItemValues[]
  /** Shown when the pool meets launch eligibility and no row editor is open. */
  continueHref?: string | null
  continueLabel?: string
  presets?: readonly RewardPreset[]
}

function buildBlankRewardValues(displayOrder: number): RewardPoolItemValues {
  return {
    rewardName: "",
    rewardTerms: "",
    weight: "1",
    displayOrder: String(displayOrder),
    isActive: true,
  }
}

/**
 * A reward at rest — stamp icon, name, terms, and controls in one compact card.
 * Terms clamp to two lines so the pool stays scannable; edit opens the full copy.
 */
function RewardRow({
  item,
  loyaltyCardId,
  onEdit,
}: {
  item: RewardPoolItemValues
  loyaltyCardId: string
  onEdit: () => void
}) {
  const rewardName = item.rewardName || "Untitled reward"

  return (
    <div
      data-active={item.isActive}
      className="grid grid-cols-[auto_1fr_auto] items-start gap-x-2.5 gap-y-0 rounded-lg border-[1.5px] p-2.5 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[active=false]:border-border data-[active=false]:bg-background data-[active=true]:border-transparent data-[active=true]:bg-secondary motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        data-active={item.isActive}
        className="grid size-8 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink data-[active=false]:border-ink/40 data-[active=false]:bg-secondary data-[active=false]:text-muted-foreground data-[active=true]:bg-seal data-[active=true]:text-seal-foreground"
      >
        <Icon icon={GiftIcon} size={14} strokeWidth={2.25} />
      </span>

      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      >
        <p className="text-sm leading-snug font-bold text-pretty break-words text-foreground">
          {rewardName}
          <span className="mono-id ml-1.5 text-muted-foreground">
            · w{item.weight || "1"}
          </span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-pretty text-ink-soft">
          {item.rewardTerms}
        </p>
      </button>

      <div className="flex shrink-0 items-center gap-1 self-start">
        <RewardActiveToggle loyaltyCardId={loyaltyCardId} item={item} compact />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${rewardName}`}
          // Honest compact size: 32px square on fine pointers, grown to the
          // 44px tap floor on coarse pointers (the Button icon-xs idiom).
          className="grid size-8 min-h-8 shrink-0 place-items-center rounded-md border border-border bg-card text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        >
          <Icon icon={PencilEdit02Icon} size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/** Inline active switch — toggles pool eligibility without opening the editor. */
function RewardActiveToggle({
  loyaltyCardId,
  item,
  compact = false,
}: {
  loyaltyCardId: string
  item: RewardPoolItemValues
  compact?: boolean
}) {
  const [optimisticActive, setOptimisticActive] = useOptimistic(item.isActive)
  const [pending, startTransition] = useTransition()
  const rewardLabel = item.rewardName || "reward"

  function toggleActive() {
    if (!item.id || pending) return

    const nextActive = !optimisticActive

    startTransition(async () => {
      setOptimisticActive(nextActive)

      const formData = new FormData()
      formData.set("rewardPoolItemId", item.id!)
      formData.set("loyaltyCardId", loyaltyCardId)
      formData.set("nextActive", String(nextActive))

      const result = await toggleRewardPoolItemActiveAction(formData)

      if (result?.error) {
        setOptimisticActive(!nextActive)
      }
    })
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticActive}
      aria-label={`${optimisticActive ? "Deactivate" : "Activate"} ${rewardLabel}`}
      disabled={!item.id || pending}
      onClick={toggleActive}
      // Type comes from .w-tag (the sanctioned mono-pill metrics — 11px, 700,
      // uppercase); the old sub-floor arbitrary size overrides are gone.
      // Honest compact heights on fine pointers grow to the 44px tap floor on
      // coarse pointers (the FilterPills / Button compact-size idiom) — this
      // switch is THE control that activates rewards toward the launch gate.
      className={cn(
        "w-tag pressable inline-flex shrink-0 items-center justify-center rounded-2xl border transition-[color,background-color,border-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
        compact ? "h-5 px-2" : "h-6 px-2.5 py-0.5",
        optimisticActive
          ? "border-ink bg-reward text-reward-foreground"
          : "border-ink/35 bg-secondary text-muted-foreground hover:border-ink/60 hover:bg-secondary/80"
      )}
    >
      {pending ? "…" : optimisticActive ? "Active" : "Off"}
    </button>
  )
}

function RewardPoolItemForm({
  loyaltyCardId,
  initialValues,
  isNew = false,
  onCancel,
}: {
  loyaltyCardId: string
  initialValues: RewardPoolItemValues
  isNew?: boolean
  onCancel: () => void
}) {
  const [state, action, pending] = useActionState(
    saveRewardPoolItemAction,
    initialPoolState
  )
  const [draft, setDraft] = useState(initialValues)

  function updateDraft<K extends keyof RewardPoolItemValues>(
    field: K,
    value: RewardPoolItemValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  const advancedTouched =
    Boolean(state.errors?.weight) || Boolean(state.errors?.displayOrder)

  // LOUD-er than a resting row: the open editor is ink-bordered so the active
  // edit surface stands apart from the quiet list around it.
  return (
    <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Eyebrow>{isNew ? "New reward" : "Edit reward"}</Eyebrow>
      </div>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
        <input type="hidden" name="rewardPoolItemId" value={draft.id ?? ""} />
        <input type="hidden" name="displayOrder" value={draft.displayOrder} />

        <Field
          id={`${draft.id ?? "new"}-rewardName`}
          label="Reward name"
          name="rewardName"
          maxLength={100}
          placeholder="e.g. Free pastry with any coffee"
          value={draft.rewardName}
          onChange={(event) => updateDraft("rewardName", event.target.value)}
          error={state.errors?.rewardName}
        />
        <TextareaField
          id={`${draft.id ?? "new"}-rewardTerms`}
          label="Reward terms"
          name="rewardTerms"
          rows={3}
          placeholder="What the member gets, and any conditions."
          value={draft.rewardTerms}
          onChange={(event) => updateDraft("rewardTerms", event.target.value)}
          error={state.errors?.rewardTerms}
        />
        <ToggleRow
          name="isActive"
          label="Active in the pool"
          hint="Counts toward the 3 needed to launch."
          checked={draft.isActive}
          onChange={(checked) => updateDraft("isActive", checked)}
        />

        <Disclosure label="Weighting" defaultOpen={advancedTouched}>
          <p className="text-xs leading-5 text-muted-foreground">
            Defaults are fine to launch. A higher weight is drawn more often.
          </p>
          <Field
            id={`${draft.id ?? "new"}-weight`}
            label="Weight"
            name="weight"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.weight}
            onChange={(event) => updateDraft("weight", event.target.value)}
            error={state.errors?.weight}
          />
        </Disclosure>

        {state.errors?.form ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isNew ? "Add reward" : "Save reward"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            <Icon icon={Cancel01Icon} size={16} />
            Cancel
          </Button>
          {!isNew && draft.id ? (
            <span className="ml-auto">
              <DeleteRewardButton rewardPoolItemId={draft.id} />
            </span>
          ) : null}
        </div>
      </form>
    </div>
  )
}

function DeleteRewardButton({
  rewardPoolItemId,
}: {
  rewardPoolItemId: string
}) {
  return (
    <form action={deleteRewardPoolItemAction}>
      <input type="hidden" name="rewardPoolItemId" value={rewardPoolItemId} />
      <Button type="submit" variant="outline" size="sm">
        <Icon icon={Delete02Icon} size={15} />
        Delete
      </Button>
    </form>
  )
}

/**
 * A section head in the medium-weight family: a sentence-case heading and sub,
 * with the step number as mono metadata on the right (the only mono caps here).
 */
function SectionHead({
  title,
  description,
  step,
  compactOnMobile = false,
}: {
  title: string
  description: string
  step: string
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
      <Eyebrow
        className={cn(
          "shrink-0 pt-0.5 whitespace-nowrap sm:pt-1",
          compactOnMobile && "hidden sm:inline"
        )}
      >
        {step}
      </Eyebrow>
    </div>
  )
}

/** A +/- stepper for small whole-number counts. The value posts via a sibling hidden input. */
function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  label: string
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
      className="inline-flex w-max items-stretch overflow-hidden rounded-lg bg-secondary"
    >
      {/* The +/- buttons declare an honest 36px height on fine pointers and
          grow to the 44px tap floor on coarse pointers (the compact Button
          idiom); items-stretch pulls the count cell up with them. */}
      <button
        type="button"
        aria-label="Fewer visits"
        disabled={atMin}
        onClick={() => onChange(String(Math.max(min, current - 1)))}
        className="grid min-h-9 w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
      >
        <Icon icon={MinusSignIcon} size={18} strokeWidth={2.25} />
      </button>
      <span
        aria-live="polite"
        className="numeric-tabular grid min-w-[3.25rem] place-items-center border-x-[1.5px] border-border bg-card font-mono text-base font-bold text-foreground"
      >
        {current}
      </span>
      <button
        type="button"
        aria-label="More visits"
        disabled={atMax}
        onClick={() => onChange(String(Math.min(max, current + 1)))}
        className="grid min-h-9 w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11"
      >
        <Icon icon={PlusSignIcon} size={18} strokeWidth={2.25} />
      </button>
    </div>
  )
}

/** A QUIET inline toggle — a filled well, not a hard-bordered card. */
function ToggleRow({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-3 sm:gap-4 sm:px-4">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-xs leading-5 text-muted-foreground">{hint}</span>
      </span>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-[var(--w-leaf)]"
      />
    </label>
  )
}

/** A QUIET input — a filled well with a transparent border that inks on focus. */
function Field({
  id,
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      <input
        id={id}
        className="h-12 w-full min-w-0 max-w-full rounded-lg border-[1.5px] border-transparent bg-secondary px-4 text-sm text-foreground transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none placeholder:text-muted-foreground/70 focus:border-ink focus:ring-3 focus:ring-ring/20 motion-reduce:transition-none"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TextareaField({
  id,
  label,
  hint,
  hintClassName,
  error,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  hint?: string
  hintClassName?: string
  error?: string
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      {hint ? (
        <p
          id={`${id}-hint`}
          className={cn(
            "text-xs leading-5 text-muted-foreground",
            hintClassName
          )}
        >
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className="w-full min-w-0 max-w-full resize-y rounded-lg border-[1.5px] border-transparent bg-secondary px-4 py-3 text-sm leading-6 text-foreground transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none placeholder:text-muted-foreground/70 focus:border-ink focus:ring-3 focus:ring-ring/20 motion-reduce:transition-none"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
