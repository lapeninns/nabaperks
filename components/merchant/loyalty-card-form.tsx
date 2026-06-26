"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
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
  type LoyaltyCardActionState,
  type RewardPoolItemActionState,
} from "@/app/app/card/actions"
import {
  EmptyState,
  Eyebrow,
  Icon,
  MonoTag,
  VenueMark,
} from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { Button } from "@/components/ui/button"
import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* MEDIUM weight: a form section — hairline, no hard shadow. */}
      <form
        action={action}
        className="grid gap-5 rounded-lg border border-border bg-card p-6"
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
            min={DEFAULT_STAMPS_REQUIRED}
            onChange={(value) => updateDraft("stampsRequired", value)}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Minimum {DEFAULT_STAMPS_REQUIRED} visits; most venues choose 3–6.
            This is how many stamps a customer collects before the reward
            unseals.
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
          value={draft.rewardTerms}
          onChange={(event) => updateDraft("rewardTerms", event.target.value)}
          error={state.errors?.rewardTerms}
        />

        <ToggleRow
          name="isActive"
          label="Card is active"
          hint="Customers can collect stamps on this card."
          checked={draft.isActive}
          onChange={(checked) => updateDraft("isActive", checked)}
        />

        {state.errors?.form ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving..." : draft.cardId ? "Save card" : "Create card"}
        </Button>
      </form>

      <StampCardPreview
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
  continueLabel = "your launch kit",
}: {
  loyaltyCardId: string
  cardName: string
  rewardPoolItems: RewardPoolItemValues[]
  /** Shown when the pool meets launch eligibility and no row editor is open. */
  continueHref?: string | null
  continueLabel?: string
}) {
  // The row currently open in the inline editor: a reward id, "new", or null.
  const [editingId, setEditingId] = useState<string | "new" | null>(null)

  const activeRewardCount = rewardPoolItems.filter(
    (item) => item.isActive
  ).length
  const ready = activeRewardCount >= REQUIRED_ACTIVE_REWARDS
  const deficit = REQUIRED_ACTIVE_REWARDS - activeRewardCount

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h2 className="text-xl leading-snug font-extrabold tracking-tight text-foreground">
            Reward pool
          </h2>
          <p className="max-w-[44ch] text-sm leading-6 text-muted-foreground">
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

      {rewardPoolItems.length === 0 && editingId !== "new" ? (
        <EmptyState
          icon={GiftIcon}
          title="No rewards in the pool yet"
          description="Add at least 3 active mystery rewards so the final stamp can reveal a prize."
          headingLevel={3}
        />
      ) : null}

      <div className="grid gap-2.5">
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
              onEdit={() => setEditingId(item.id ?? null)}
            />
          )
        )}

        {editingId === "new" ? (
          <RewardPoolItemForm
            loyaltyCardId={loyaltyCardId}
            initialValues={{
              rewardName: "",
              rewardTerms: "",
              weight: "1",
              displayOrder: String(rewardPoolItems.length + 1),
              isActive: true,
            }}
            isNew
            onCancel={() => setEditingId(null)}
          />
        ) : null}
      </div>

      {editingId !== "new" ? (
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-transparent px-4 py-3 text-sm font-bold text-foreground transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
        >
          <Icon icon={Add01Icon} size={16} strokeWidth={2.25} />
          Add a reward
        </button>
      ) : null}

      {ready && editingId === null && continueHref ? (
        <Button asChild className="w-full">
          <Link href={continueHref}>Continue to {continueLabel}</Link>
        </Button>
      ) : null}
    </section>
  )
}

/**
 * A reward at rest — a compact, QUIET row. Active rewards read as filled wells;
 * inactive ones fade back with a hairline. The full editor only appears when a
 * row is opened, so the pool reads as a list instead of a stack of forms.
 */
function RewardRow({
  item,
  onEdit,
}: {
  item: RewardPoolItemValues
  onEdit: () => void
}) {
  return (
    <div
      data-active={item.isActive}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-[1.5px] p-3 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[active=false]:border-border data-[active=false]:bg-background data-[active=true]:border-transparent data-[active=true]:bg-secondary motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        data-active={item.isActive}
        className="grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink text-[0.95rem] data-[active=false]:border-ink/40 data-[active=false]:bg-secondary data-[active=false]:text-muted-foreground data-[active=true]:bg-seal data-[active=true]:text-seal-foreground"
      >
        <Icon icon={GiftIcon} size={16} strokeWidth={2.25} />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {item.rewardName || "Untitled reward"}
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">
          {item.rewardTerms}
        </p>
        <p className="mt-1 font-mono text-[0.62rem] font-bold tracking-[0.05em] text-ink-soft uppercase">
          Weight {item.weight || "1"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <MonoTag tone={item.isActive ? "leaf" : "plain"}>
          {item.isActive ? "Active" : "Inactive"}
        </MonoTag>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.rewardName || "reward"}`}
          className="grid size-9 place-items-center rounded-lg border-[1.5px] border-border bg-card text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
        >
          <Icon icon={PencilEdit02Icon} size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
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
          placeholder="What the customer gets, and any conditions."
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
}: {
  title: string
  description: string
  step: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-2">
        <h2 className="text-xl leading-snug font-extrabold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-[44ch] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <Eyebrow className="shrink-0 pt-1 whitespace-nowrap">{step}</Eyebrow>
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
  const current = Number.isFinite(parsed) ? parsed : min
  const atMin = current <= min

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex w-max items-stretch overflow-hidden rounded-lg bg-secondary"
    >
      <button
        type="button"
        aria-label="Fewer visits"
        disabled={atMin}
        onClick={() => onChange(String(Math.max(min, current - 1)))}
        className="grid w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
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
        onClick={() => onChange(String(Math.min(max, current + 1)))}
        className="grid w-11 place-items-center text-foreground transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:bg-ink/10 focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
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
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-secondary px-4 py-3">
      <span className="grid gap-0.5">
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
        className="h-12 rounded-lg border-[1.5px] border-transparent bg-secondary px-4 text-sm text-foreground transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none placeholder:text-muted-foreground/70 focus:border-ink focus:ring-3 focus:ring-ring/20 motion-reduce:transition-none"
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
  error,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="resize-y rounded-lg border-[1.5px] border-transparent bg-secondary px-4 py-3 text-sm leading-6 text-foreground transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none placeholder:text-muted-foreground/70 focus:border-ink focus:ring-3 focus:ring-ring/20 motion-reduce:transition-none"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
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

/**
 * The customer preview — the LOUD hero artifact. It keeps the full receipt
 * treatment (2px ink border, hard shadow, perforated edge) so it reads as the
 * thing the customer actually holds, against the quieter form beside it.
 */
function StampCardPreview({
  merchantName,
  locationName,
  draft,
  activeRewardCount,
}: {
  merchantName: string
  locationName: string
  draft: LoyaltyCardFormValues
  activeRewardCount: number
}) {
  const stampsRequired = Math.max(
    Number.parseInt(draft.stampsRequired, 10) || DEFAULT_STAMPS_REQUIRED,
    DEFAULT_STAMPS_REQUIRED
  )
  const earnedPreviewCount = Math.min(stampsRequired - 1, 2)

  return (
    <div className="h-fit lg:sticky lg:top-4">
      <aside className="surface-card grid gap-4 p-5">
        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <VenueMark name={merchantName} size={48} />
            <div className="grid gap-1">
              <Eyebrow>Customer preview</Eyebrow>
              <h2 className="text-2xl leading-tight font-extrabold">
                {draft.cardName || "Mystery Visit Card"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {merchantName} · {locationName}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: Math.min(stampsRequired, 12) }).map(
            (_, index) => {
              const earned = index < earnedPreviewCount
              return (
                <span
                  key={index}
                  role="img"
                  className={
                    earned
                      ? "aspect-square rounded-full border-2 border-ink bg-primary shadow-xs"
                      : "aspect-square rounded-full border-2 border-dashed border-ink bg-background"
                  }
                  aria-label={earned ? "Earned stamp" : "Empty stamp"}
                />
              )
            }
          )}
        </div>

        {stampsRequired > 12 ? (
          <p className="text-xs text-muted-foreground">
            Preview shows 12 of {stampsRequired} visit slots.
          </p>
        ) : null}

        <div className="rounded-lg border-2 border-ink bg-accent p-4">
          <Eyebrow>Locked reward</Eyebrow>
          <p className="mt-1 text-lg font-extrabold">Surprise reward</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Complete {stampsRequired} visits to reveal your surprise reward.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {draft.rewardTerms}
          </p>
        </div>

        <hr className="w-rule" />

        <Eyebrow>
          {draft.isActive ? "Active for new stamps" : "Inactive: no new stamps"}
        </Eyebrow>
        <Eyebrow>
          {activeRewardCount} active pool reward
          {activeRewardCount === 1 ? "" : "s"}
        </Eyebrow>
      </aside>
      <div aria-hidden className="receipt-edge" />
    </div>
  )
}
