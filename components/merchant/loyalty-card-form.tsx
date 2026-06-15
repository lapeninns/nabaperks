"use client"

import { useActionState, useState } from "react"
import { GiftIcon } from "@hugeicons/core-free-icons"

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
  MonoTag,
  PageTitle,
  SectionHeader,
  VenueMark,
} from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"

type LoyaltyCardFormValues = {
  cardId?: string
  cardName: string
  stampsRequired: string
  rewardTerms: string
  minSpendPence: string
  isActive: boolean
}

type RewardPoolItemValues = {
  id?: string
  rewardName: string
  rewardTerms: string
  minSpendPence: string
  weight: string
  displayOrder: string
  isActive: boolean
}

type LoyaltyCardFormProps = {
  initialValues: LoyaltyCardFormValues
  rewardPoolItems: RewardPoolItemValues[]
  merchantName: string
  locationName: string
}

const initialCardState: LoyaltyCardActionState = {}
const initialPoolState: RewardPoolItemActionState = {}

export function LoyaltyCardForm({
  initialValues,
  rewardPoolItems,
  merchantName,
  locationName,
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

  const activeRewardCount = rewardPoolItems.filter(
    (item) => item.isActive
  ).length

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        <form action={action} className="surface-card grid gap-5 p-6">
          <input type="hidden" name="cardId" value={draft.cardId ?? ""} />
          <input
            type="hidden"
            name="minSpendPence"
            value={draft.minSpendPence}
          />
          <PageTitle
            eyebrow="Step 1 · Build card"
            title="Build your visit card"
            description={`One active card for ${locationName}, with a reward revealed after the final qualifying visit.`}
            titleClassName="sm:text-3xl"
          />

          <Field
            id="cardName"
            label="Card name"
            name="cardName"
            value={draft.cardName}
            onChange={(event) => updateDraft("cardName", event.target.value)}
            error={state.errors?.cardName}
          />

          <Field
            id="stampsRequired"
            label="Visits to reveal"
            name="stampsRequired"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.stampsRequired}
            onChange={(event) =>
              updateDraft("stampsRequired", event.target.value)
            }
            error={state.errors?.stampsRequired}
          />

          <TextareaField
            id="rewardTerms"
            label="Mystery reward terms"
            name="rewardTerms"
            value={draft.rewardTerms}
            onChange={(event) => updateDraft("rewardTerms", event.target.value)}
            error={state.errors?.rewardTerms}
          />

          <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-ink bg-secondary/50 px-4 py-3 text-sm font-bold">
            <span>Card active</span>
            <input
              name="isActive"
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                updateDraft("isActive", event.target.checked)
              }
              className="size-5 accent-primary"
            />
          </label>

          {state.errors?.form ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.errors.form}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving..." : draft.cardId ? "Save card" : "Create card"}
          </Button>
        </form>

        <section className="surface-card grid gap-4 p-6">
          <SectionHeader
            eyebrow="Step 2 · Reward"
            title="Add a surprise reward"
            description="At least one active reward is needed before the venue QR can launch or a final stamp can reveal a prize."
          />

          {draft.cardId ? (
            <div className="grid gap-4">
              {activeRewardCount < 1 ? (
                <StatusBanner
                  tone="warning"
                  title="QR launch is blocked until a reward is active."
                >
                  Add a reward below or switch an existing reward back to active
                  so customers can reveal a prize on their final stamp.
                </StatusBanner>
              ) : (
                <StatusBanner tone="success" title="QR launch eligible.">
                  {activeRewardCount} active reward
                  {activeRewardCount === 1 ? "" : "s"} can be assigned when a
                  customer completes the card.
                </StatusBanner>
              )}
              {rewardPoolItems.length === 0 ? (
                <EmptyState
                  icon={GiftIcon}
                  title="No rewards in the pool yet"
                  description="Create the first active mystery reward so the QR launch checklist can pass."
                  headingLevel={3}
                />
              ) : null}
              {rewardPoolItems.map((item) => (
                <RewardPoolItemForm
                  key={item.id}
                  loyaltyCardId={draft.cardId ?? ""}
                  initialValues={item}
                />
              ))}
              <RewardPoolItemForm
                loyaltyCardId={draft.cardId}
                initialValues={{
                  rewardName: "",
                  rewardTerms: "",
                  minSpendPence: "",
                  weight: "1",
                  displayOrder: String(rewardPoolItems.length + 1),
                  isActive: true,
                }}
                isNew
              />
            </div>
          ) : (
            <StatusBanner tone="neutral" title="Save the card before rewards.">
              The reward pool is tied to a saved loyalty card id, so this step
              unlocks after the first card save.
            </StatusBanner>
          )}
        </section>
      </div>

      <StampCardPreview
        merchantName={merchantName}
        locationName={locationName}
        draft={draft}
        activeRewardCount={activeRewardCount}
      />
    </div>
  )
}

function RewardPoolItemForm({
  loyaltyCardId,
  initialValues,
  isNew = false,
}: {
  loyaltyCardId: string
  initialValues: RewardPoolItemValues
  isNew?: boolean
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
    Boolean(state.errors?.weight) ||
    Boolean(state.errors?.displayOrder) ||
    Boolean(state.errors?.minSpendPence) ||
    draft.minSpendPence !== ""

  return (
    <div className="surface-card grid gap-4 p-4">
      {!isNew ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-dashed border-ink/15 bg-secondary/50 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold">
              {draft.rewardName || "Untitled reward"}
            </p>
            <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
              Minimum spend:{" "}
              {draft.minSpendPence
                ? `£${formatPence(draft.minSpendPence)}`
                : "None"}{" "}
              · Weight: {draft.weight || "1"} · Order:{" "}
              {draft.displayOrder || "0"}
            </p>
          </div>
          <MonoTag tone={draft.isActive ? "leaf" : "plain"}>
            {draft.isActive ? "Active reward" : "Inactive reward"}
          </MonoTag>
        </div>
      ) : null}
      <form action={action} className="grid gap-4">
        <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
        <input type="hidden" name="rewardPoolItemId" value={draft.id ?? ""} />
        <Field
          id={`${draft.id ?? "new"}-rewardName`}
          label="Reward name"
          name="rewardName"
          value={draft.rewardName}
          onChange={(event) => updateDraft("rewardName", event.target.value)}
          error={state.errors?.rewardName}
        />
        <TextareaField
          id={`${draft.id ?? "new"}-rewardTerms`}
          label="Reward terms"
          name="rewardTerms"
          rows={3}
          value={draft.rewardTerms}
          onChange={(event) => updateDraft("rewardTerms", event.target.value)}
          error={state.errors?.rewardTerms}
        />
        <label className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-secondary/50 px-4 py-3 text-sm font-bold">
          <span>Active reward</span>
          <input
            name="isActive"
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => updateDraft("isActive", event.target.checked)}
            className="size-5 accent-primary"
          />
        </label>

        <Disclosure
          label="Weighting, order and spend"
          defaultOpen={advancedTouched}
        >
          <p className="text-xs leading-5 text-muted-foreground">
            Defaults are fine to launch. Weight makes a reward more likely;
            order sorts the list; minimum spend is optional.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <Field
              id={`${draft.id ?? "new"}-displayOrder`}
              label="Order"
              name="displayOrder"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.displayOrder}
              onChange={(event) =>
                updateDraft("displayOrder", event.target.value)
              }
              error={state.errors?.displayOrder}
            />
            <Field
              id={`${draft.id ?? "new"}-minSpendPence`}
              label="Min spend"
              name="minSpendPence"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Optional pence"
              value={draft.minSpendPence}
              onChange={(event) =>
                updateDraft("minSpendPence", event.target.value)
              }
              error={state.errors?.minSpendPence}
            />
          </div>
        </Disclosure>

        {state.errors?.form ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isNew ? "Add reward" : "Save reward"}
          </Button>
        </div>
      </form>
      {!isNew && draft.id ? (
        <form action={deleteRewardPoolItemAction}>
          <input type="hidden" name="rewardPoolItemId" value={draft.id} />
          <Button type="submit" variant="outline">
            Delete or archive
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function formatPence(value: string) {
  const pence = Number.parseInt(value, 10)
  if (!Number.isFinite(pence)) return value
  return (pence / 100).toFixed(2)
}

function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-lg border-2 border-ink bg-secondary/60 px-4 text-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
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

function TextareaField({
  id,
  label,
  error,
  rows = 5,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="resize-none rounded-lg border-2 border-ink bg-secondary/60 px-4 py-3 text-sm leading-6 transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
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
    Number.parseInt(draft.stampsRequired, 10) || 3,
    1
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
