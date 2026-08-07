"use client"

import { useRouter } from "next/navigation"
import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  GiftIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  addRewardPresetsAction,
  deleteRewardPoolItemAction,
  saveRewardPoolItemAction,
  toggleRewardPoolItemActiveAction,
  type RewardPresetBatchActionState,
  type RewardPoolItemActionState,
} from "@/app/app/card/actions"
import { EmptyState, Eyebrow, Icon, MonoTag } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import {
  Field,
  TextareaField,
  ToggleRow,
} from "@/components/merchant/merchant-form-fields"
import { Button } from "@/components/ui/button"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import {
  reconcileSelectedPresetIdsAfterRewardSave,
  rewardNameKey,
  rewardPresetToPoolItemValues,
  type RewardPreset,
} from "@/lib/merchant/reward-presets"
import { cn } from "@/lib/utils"

export type RewardPoolItemValues = {
  id?: string
  rewardName: string
  rewardTerms: string
  weight: string
  displayOrder: string
  isActive: boolean
}

const initialPoolState: RewardPoolItemActionState = {}
const initialPresetBatchState: RewardPresetBatchActionState = {}

export function RewardPoolForm({
  loyaltyCardId,
  cardName,
  rewardPoolItems,
  presets = [],
}: RewardPoolFormProps) {
  const router = useRouter()
  const [batchState, batchAction, batchPending] = useActionState(
    addRewardPresetsAction,
    initialPresetBatchState
  )
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [items, setItems] = useState(rewardPoolItems)
  const [itemsSource, setItemsSource] = useState(rewardPoolItems)
  const [handledBatchState, setHandledBatchState] = useState(batchState)
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([])
  const [dismissedBatchFeedback, setDismissedBatchFeedback] =
    useState<RewardPresetBatchActionState | null>(null)
  const [editorReturnFocusId, setEditorReturnFocusId] = useState<string | null>(
    null
  )
  const [newRewardValues, setNewRewardValues] = useState<RewardPoolItemValues>(
    buildBlankRewardValues(rewardPoolItems.length + 1)
  )
  const [newRewardKey, setNewRewardKey] = useState("blank")
  const [presetsDefaultOpen] = useState(
    () => rewardPoolItems.length < LAUNCH_MIN_ACTIVE_REWARDS
  )
  const batchErrorRef = useRef<HTMLParagraphElement>(null)
  const batchSuccessRef = useRef<HTMLParagraphElement>(null)

  if (itemsSource !== rewardPoolItems) {
    setItemsSource(rewardPoolItems)
    setItems(rewardPoolItems)
  }

  if (handledBatchState !== batchState) {
    setHandledBatchState(batchState)

    if (batchState.errors?.form) {
      setSelectedPresetIds(batchState.fields?.presetIds ?? [])
    } else if (batchState.saved && batchState.items) {
      setItems((current) =>
        mergeRewardPoolItems(current, batchState.items ?? [])
      )
      setSelectedPresetIds([])
    }
  }

  const batchFeedbackVisible = dismissedBatchFeedback !== batchState

  useEffect(() => {
    if (!batchFeedbackVisible) return
    if (batchState.errors?.form) batchErrorRef.current?.focus()
    if (batchState.saved) {
      batchSuccessRef.current?.focus()
      router.refresh()
    }
  }, [batchFeedbackVisible, batchState, router])

  const activeRewardCount = items.filter((item) => item.isActive).length
  const ready = activeRewardCount >= LAUNCH_MIN_ACTIVE_REWARDS
  const deficit = Math.max(0, LAUNCH_MIN_ACTIVE_REWARDS - activeRewardCount)
  const projectedActiveRewardCount =
    activeRewardCount + selectedPresetIds.length
  const pooledRewardsByName = new Map(
    items.map((item) => [rewardNameKey(item.rewardName), item])
  )

  function dismissBatchFeedback() {
    if (batchState.errors?.form || batchState.saved) {
      setDismissedBatchFeedback(batchState)
    }
  }

  function openBlankReward() {
    if (batchPending) return
    dismissBatchFeedback()
    setEditorReturnFocusId(null)
    setNewRewardValues(buildBlankRewardValues(items.length + 1))
    setNewRewardKey(`blank-${items.length + 1}`)
    setEditingId("new")
  }

  function togglePreset(preset: RewardPreset) {
    if (
      batchPending ||
      pooledRewardsByName.has(rewardNameKey(preset.rewardName))
    ) {
      return
    }

    dismissBatchFeedback()
    setSelectedPresetIds((current) =>
      current.includes(preset.id)
        ? current.filter((id) => id !== preset.id)
        : [...current, preset.id]
    )
  }

  function openPresetReward(
    preset: RewardPreset,
    existingItem: RewardPoolItemValues | undefined
  ) {
    if (batchPending) return
    dismissBatchFeedback()
    setSelectedPresetIds((current) => current.filter((id) => id !== preset.id))
    setEditorReturnFocusId(`preset-customise-${preset.id}`)

    if (existingItem?.id) {
      setEditingId(existingItem.id)
      return
    }

    setNewRewardValues(rewardPresetToPoolItemValues(preset, items.length + 1))
    setNewRewardKey(preset.id)
    setEditingId("new")
  }

  function closeEditor() {
    const returnFocusId = editorReturnFocusId
    setEditingId(null)
    setEditorReturnFocusId(null)

    if (returnFocusId) {
      window.requestAnimationFrame(() => {
        document.getElementById(returnFocusId)?.focus()
      })
    }
  }

  function clearPresetSelection() {
    const returnFocusId = selectedPresetIds.at(0)
      ? `preset-select-${selectedPresetIds[0]}`
      : null
    dismissBatchFeedback()
    setSelectedPresetIds([])

    if (returnFocusId) {
      window.requestAnimationFrame(() => {
        document.getElementById(returnFocusId)?.focus()
      })
    }
  }

  function handleItemSaved(saved: RewardPoolItemValues) {
    setSelectedPresetIds((current) =>
      reconcileSelectedPresetIdsAfterRewardSave(
        presets,
        current,
        saved.rewardName
      )
    )
    setItems((current) => {
      const index = current.findIndex((item) => item.id === saved.id)

      if (index >= 0) {
        const next = [...current]
        next[index] = saved
        return next
      }

      return [...current, saved].sort(
        (left, right) =>
          Number.parseInt(left.displayOrder, 10) -
          Number.parseInt(right.displayOrder, 10)
      )
    })
    setEditingId(null)
  }

  function handleItemToggled(rewardPoolItemId: string, nextActive: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === rewardPoolItemId ? { ...item, isActive: nextActive } : item
      )
    )
  }

  return (
    <section
      className={cn(
        "surface-card grid min-w-0 gap-4 p-3 sm:p-6",
        selectedPresetIds.length > 0 &&
          editingId === null &&
          "pb-[8.75rem] sm:pb-6"
      )}
    >
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
            : `${activeRewardCount} / ${LAUNCH_MIN_ACTIVE_REWARDS} active`}
        </MonoTag>
      </div>

      {/* Screen-reader status: the visual MonoTag count isn't announced when a
          preset/reward is added or activated, so mirror it in a polite live
          region so assistive tech hears progress toward the launch gate. */}
      <p className="sr-only" role="status" aria-live="polite">
        {ready
          ? `${activeRewardCount} active rewards — ready to launch.`
          : `${activeRewardCount} of ${LAUNCH_MIN_ACTIVE_REWARDS} active rewards.`}
      </p>

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
        // Returning merchants come here to read their pool, not to shop the
        // catalogue: nine dashed tiles ahead of the list cost ~700px on a
        // phone. The ideas open on first paint only while the pool is still
        // short of the launch minimum. Frozen at mount so the browser's own
        // toggle is never yanked back mid-edit when a save lands.
        <Disclosure label="Reward ideas" defaultOpen={presetsDefaultOpen}>
          <p className="max-w-[54ch] text-xs leading-5 text-muted-foreground">
            Pick a few to start. Nothing is saved until you tap Add. You can
            edit each reward afterwards.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((preset) => {
              const existingItem = pooledRewardsByName.get(
                rewardNameKey(preset.rewardName)
              )
              const selected = selectedPresetIds.includes(preset.id)
              const existing = Boolean(existingItem)
              const stateCopy = existing
                ? `${preset.rewardName} is already in your pool${existingItem?.isActive ? "." : " · Off."}`
                : selected
                  ? "Selected — review the batch below."
                  : preset.description

              return (
                <div
                  key={preset.id}
                  className={cn(
                    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border-2 border-dashed transition-[background-color,border-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                    existing
                      ? "border-reward/45 bg-reward/5"
                      : selected
                        ? "border-seal bg-seal/10"
                        : "border-ink/25 bg-transparent hover:border-ink hover:bg-card"
                  )}
                >
                  <button
                    id={`preset-select-${preset.id}`}
                    type="button"
                    aria-pressed={selected}
                    aria-label={
                      existing
                        ? `${preset.rewardName} is already in your pool`
                        : selected
                          ? `Remove ${preset.rewardName} from selection`
                          : `Select ${preset.rewardName}`
                    }
                    disabled={existing || batchPending}
                    onClick={() => togglePreset(preset)}
                    onKeyDown={(event) => {
                      if (event.key !== " ") return
                      event.preventDefault()
                      if (event.repeat) return
                      togglePreset(preset)
                    }}
                    className="focus-ring grid min-h-16 min-w-0 content-start gap-1 px-3 py-2.5 text-left disabled:cursor-default disabled:opacity-100"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm leading-snug font-extrabold text-pretty text-foreground">
                        {preset.rewardName}
                      </span>
                      <Icon
                        icon={existing || selected ? Tick02Icon : PlusSignIcon}
                        size={16}
                        strokeWidth={2.5}
                        className={cn(
                          "mt-0.5 shrink-0",
                          existing
                            ? "text-reward"
                            : selected
                              ? "text-foreground"
                              : "text-primary"
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-xs leading-4 text-pretty",
                        existing || selected
                          ? "font-bold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {stateCopy}
                    </span>
                  </button>
                  <button
                    id={`preset-customise-${preset.id}`}
                    type="button"
                    aria-label={
                      existingItem
                        ? `Edit ${preset.rewardName}`
                        : `Customise ${preset.rewardName}`
                    }
                    disabled={batchPending}
                    onClick={() => openPresetReward(preset, existingItem)}
                    className="focus-ring grid min-h-16 min-w-11 place-items-center border-l border-ink/15 bg-card/45 px-2 text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:min-w-12"
                  >
                    <Icon
                      icon={PencilEdit02Icon}
                      size={16}
                      strokeWidth={2.25}
                    />
                    <span className="sr-only">
                      {existingItem ? "Edit" : "Customise"}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </Disclosure>
      ) : null}

      {selectedPresetIds.length > 0 && editingId === null ? (
        // The tray floats above the md:hidden console tab bar (3.5rem + safe
        // area) — at the old 0.75rem offset the Clear/Add row sat underneath
        // it on a phone. It stays `fixed` below sm by contract: RA-11 in
        // tests/contracts/reward-preset-atomic-add requires one mobile-
        // persistent Add action that never needs scrolling to reach.
        <form
          action={batchAction}
          className="fixed inset-x-3 bottom-[calc(3.5rem+max(0.75rem,env(safe-area-inset-bottom)))] z-30 mx-auto grid max-w-[calc(100vw-1.5rem)] gap-2 rounded-lg border-2 border-ink bg-card/95 p-3 shadow-hard backdrop-blur-sm sm:static sm:inset-auto sm:z-auto sm:max-w-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:bg-card sm:p-4 sm:backdrop-blur-none"
        >
          <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
          {selectedPresetIds.map((presetId) => (
            <input
              key={presetId}
              type="hidden"
              name="presetId"
              value={presetId}
            />
          ))}
          {/* One line: the resting count is already in the header MonoTag, so
              the tray only carries what the selection changes. */}
          <p className="text-sm font-extrabold text-pretty text-foreground">
            {selectedPresetIds.length} selected · {projectedActiveRewardCount}{" "}
            active after add
            <span className="block text-xs leading-5 font-normal text-muted-foreground">
              One press adds the full selection. If one fails, none are added.
            </span>
          </p>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
            <Button
              type="button"
              variant="ghost"
              disabled={batchPending}
              onClick={clearPresetSelection}
            >
              Clear
            </Button>
            <Button type="submit" disabled={batchPending}>
              {batchPending
                ? `Adding ${selectedPresetIds.length} reward${selectedPresetIds.length === 1 ? "" : "s"}…`
                : `Add ${selectedPresetIds.length} reward${selectedPresetIds.length === 1 ? "" : "s"}`}
            </Button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {batchPending
              ? `Adding ${selectedPresetIds.length} rewards…`
              : `${selectedPresetIds.length} rewards selected.`}
          </p>
        </form>
      ) : null}

      {batchFeedbackVisible && batchState.errors?.form ? (
        <p
          ref={batchErrorRef}
          role="alert"
          tabIndex={-1}
          className="focus-target rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {batchState.errors.form}
        </p>
      ) : batchFeedbackVisible && batchState.saved && batchState.message ? (
        <p
          ref={batchSuccessRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="focus-target rounded-lg border border-reward/40 bg-reward/10 px-3 py-2 text-sm font-bold text-foreground"
        >
          {batchState.message}
          {batchState.activeRewardCount !== undefined ? (
            <span>
              {" "}
              {batchState.activeRewardCount} of {LAUNCH_MIN_ACTIVE_REWARDS}{" "}
              active
              {batchState.activeRewardCount >= LAUNCH_MIN_ACTIVE_REWARDS
                ? " — ready to continue."
                : "."}
            </span>
          ) : null}
        </p>
      ) : null}

      {items.length === 0 && editingId !== "new" ? (
        <EmptyState
          icon={GiftIcon}
          title="No rewards in the pool yet"
          description="Add at least 3 active mystery rewards so the final stamp can reveal a prize."
          headingLevel={3}
        />
      ) : null}

      <div className="grid gap-2">
        {items.map((item) =>
          editingId === item.id ? (
            <RewardPoolItemForm
              key={item.id}
              loyaltyCardId={loyaltyCardId}
              initialValues={item}
              onCancel={closeEditor}
              onSaved={handleItemSaved}
            />
          ) : (
            <RewardRow
              key={item.id}
              item={item}
              loyaltyCardId={loyaltyCardId}
              disabled={batchPending}
              onEdit={() => {
                if (batchPending) return
                setEditorReturnFocusId(null)
                setEditingId(item.id ?? null)
              }}
              onToggle={handleItemToggled}
            />
          )
        )}

        {editingId === "new" ? (
          <RewardPoolItemForm
            key={`new-${newRewardKey}`}
            loyaltyCardId={loyaltyCardId}
            initialValues={newRewardValues}
            isNew
            onCancel={closeEditor}
            onSaved={handleItemSaved}
          />
        ) : null}
      </div>

      {editingId === null ? (
        <button
          type="button"
          disabled={batchPending}
          onClick={openBlankReward}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink/25 bg-transparent px-4 py-3 text-sm font-bold text-foreground transition-[border-color,background-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:border-ink hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          <Icon icon={Add01Icon} size={16} strokeWidth={2.25} />
          Add a reward
        </button>
      ) : null}

      {selectedPresetIds.length > 0 && editingId === null ? (
        // The section's own pb clears the fixed tray; this clears the console
        // tab bar the tray now floats above, so the last row stays reachable.
        <div aria-hidden="true" className="h-14 sm:hidden" />
      ) : null}
    </section>
  )
}

type RewardPoolFormProps = {
  loyaltyCardId: string
  cardName: string
  rewardPoolItems: RewardPoolItemValues[]
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

function mergeRewardPoolItems(
  current: RewardPoolItemValues[],
  incoming: readonly RewardPoolItemValues[]
): RewardPoolItemValues[] {
  const byId = new Map(
    current.filter((item) => item.id).map((item) => [item.id!, item])
  )

  for (const item of incoming) {
    if (item.id) byId.set(item.id, item)
  }

  return [...byId.values()].sort(
    (left, right) =>
      Number.parseInt(left.displayOrder, 10) -
      Number.parseInt(right.displayOrder, 10)
  )
}

/**
 * A reward at rest — stamp icon, name, terms, and controls in one compact card.
 * Terms clamp to two lines so the pool stays scannable; edit opens the full copy.
 */
function RewardRow({
  item,
  loyaltyCardId,
  disabled = false,
  onEdit,
  onToggle,
}: {
  item: RewardPoolItemValues
  loyaltyCardId: string
  disabled?: boolean
  onEdit: () => void
  onToggle: (rewardPoolItemId: string, nextActive: boolean) => void
}) {
  const rewardName = item.rewardName || "Untitled reward"

  return (
    <div
      data-active={item.isActive}
      className="grid grid-cols-[auto_1fr_auto] items-start gap-x-2.5 gap-y-0 rounded-lg border-2 p-2.5 transition-[border-color,background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[active=false]:border-border data-[active=false]:bg-background data-[active=true]:border-transparent data-[active=true]:bg-secondary motion-reduce:transition-none"
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
        disabled={disabled}
        onClick={onEdit}
        className="focus-ring min-w-0 rounded-md text-left disabled:cursor-not-allowed disabled:opacity-60"
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
        <RewardActiveToggle
          loyaltyCardId={loyaltyCardId}
          item={item}
          compact
          disabled={disabled}
          onToggle={onToggle}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          aria-label={`Edit ${rewardName}`}
          // Honest compact size: 32px square on fine pointers, grown to the
          // 44px tap floor on coarse pointers (the Button icon-xs idiom).
          className="focus-ring grid size-8 min-h-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-[color,background-color,border-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none hover:border-ink hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        >
          <Icon icon={PencilEdit02Icon} size={16} strokeWidth={2} />
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
  disabled = false,
  onToggle,
}: {
  loyaltyCardId: string
  item: RewardPoolItemValues
  compact?: boolean
  disabled?: boolean
  onToggle: (rewardPoolItemId: string, nextActive: boolean) => void
}) {
  const router = useRouter()
  const [optimisticActive, setOptimisticActive] = useOptimistic(item.isActive)
  const [pending, startTransition] = useTransition()
  const rewardLabel = item.rewardName || "reward"

  function toggleActive() {
    if (disabled || !item.id || pending) return

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
        return
      }

      onToggle(item.id!, nextActive)

      if (result.qrStatus) {
        const params = new URLSearchParams({
          tab: "rewards",
          saved: "pool",
          qr: result.qrStatus,
        })
        router.replace(`/app/launch?${params.toString()}`)
      }

      router.refresh()
    })
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticActive}
      aria-label={`${optimisticActive ? "Deactivate" : "Activate"} ${rewardLabel}`}
      disabled={disabled || !item.id || pending}
      onClick={toggleActive}
      // Type comes from .w-tag (the sanctioned mono-pill metrics — 11px, 700,
      // uppercase); the old sub-floor arbitrary size overrides are gone.
      // Honest compact heights on fine pointers grow to the 44px tap floor on
      // coarse pointers (the FilterPills / Button compact-size idiom) — this
      // switch is THE control that activates rewards toward the launch gate.
      className={cn(
        "w-tag pressable focus-ring inline-flex shrink-0 items-center justify-center rounded-lg border transition-[color,background-color,border-color,opacity] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
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
  onSaved,
}: {
  loyaltyCardId: string
  initialValues: RewardPoolItemValues
  isNew?: boolean
  onCancel: () => void
  onSaved: (item: RewardPoolItemValues) => void
}) {
  const router = useRouter()
  const [state, action] = useActionState(
    saveRewardPoolItemAction,
    initialPoolState
  )
  const [draft, setDraft] = useState(initialValues)
  const handledSaveRef = useRef<string | null>(null)

  function updateDraft<K extends keyof RewardPoolItemValues>(
    field: K,
    value: RewardPoolItemValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  useEffect(() => {
    if (!state.saved || !state.fields?.rewardPoolItemId) return
    if (handledSaveRef.current === state.fields.rewardPoolItemId) return

    handledSaveRef.current = state.fields.rewardPoolItemId

    onSaved({
      id: state.fields.rewardPoolItemId,
      rewardName: state.fields.rewardName ?? "",
      rewardTerms: state.fields.rewardTerms ?? "",
      weight: state.fields.weight ?? "1",
      displayOrder: state.fields.displayOrder ?? "0",
      isActive: state.fields.isActive ?? false,
    })

    const params = new URLSearchParams({
      tab: "rewards",
      saved: "pool",
    })
    if (state.qrStatus) params.set("qr", state.qrStatus)

    router.replace(`/app/launch?${params.toString()}`)
    router.refresh()
  }, [onSaved, router, state])

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
          autoFocus
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
          <SubmitButton pendingLabel="Saving…">
            {isNew ? "Add reward" : "Save reward"}
          </SubmitButton>
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

/**
 * Destructive delete with an armed confirm step. No nested `<form>`: the
 * confirm button submits the surrounding edit form to the delete action via
 * React 19 `formAction`, which keeps the HTML valid. The hidden input keeps
 * the control self-contained (the action reads `rewardPoolItemId`; the edit
 * form's own hidden field carries the same value).
 */
function DeleteRewardButton({
  rewardPoolItemId,
}: {
  rewardPoolItemId: string
}) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setArmed(true)}
      >
        <Icon icon={Delete02Icon} size={16} />
        Delete
      </Button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="rewardPoolItemId" value={rewardPoolItemId} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        formAction={deleteRewardPoolItemAction}
      >
        <Icon icon={Delete02Icon} size={16} />
        Confirm delete
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setArmed(false)}
      >
        Keep it
      </Button>
    </span>
  )
}
