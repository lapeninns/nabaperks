"use client"

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  saveBirthdayRewardAction,
  type BirthdayRewardActionState,
} from "@/app/app/card/actions"
import {
  Field,
  TextareaField,
  ToggleRow,
} from "@/components/merchant/merchant-form-fields"
import type { BirthdayRewardTemplate } from "@/lib/merchant/birthday-reward-template"

const initialState: BirthdayRewardActionState = {}
type BirthdayRewardSaveAction = (
  state: BirthdayRewardActionState,
  formData: FormData
) => Promise<BirthdayRewardActionState>
type PendingBirthdaySave = readonly [boolean, string, string, boolean]

export function BirthdayRewardForm({
  loyaltyCardId,
  initialValues,
  template,
  saveAction = saveBirthdayRewardAction,
}: {
  loyaltyCardId: string
  initialValues: {
    enabled: boolean
    rewardName: string
    rewardTerms: string
    requiresAgeCheck: boolean
  }
  template: BirthdayRewardTemplate
  saveAction?: BirthdayRewardSaveAction
}) {
  const [state, action, pending] = useActionState(saveAction, initialState)
  const [enabled, setEnabled] = useState(
    state.fields?.enabled ?? initialValues.enabled
  )
  const [rewardName, setRewardName] = useState(
    state.fields?.rewardName ?? initialValues.rewardName
  )
  const [rewardTerms, setRewardTerms] = useState(
    state.fields?.rewardTerms ?? initialValues.rewardTerms
  )
  const [dirty, setDirty] = useState(false)
  const [requiresAgeCheck, setRequiresAgeCheck] = useState(
    state.fields?.requiresAgeCheck ?? initialValues.requiresAgeCheck
  )
  const savedValues = useRef(initialValues)
  const saveInFlight = useRef(false)
  const queuedSave = useRef<PendingBirthdaySave | null>(null)

  const dispatchSave = useCallback(
    (
      nextEnabled: boolean,
      nextName: string,
      nextTerms: string,
      nextRequiresAgeCheck: boolean
    ) => {
      const formData = new FormData()
      formData.set("loyaltyCardId", loyaltyCardId)
      if (nextEnabled) formData.set("enabled", "on")
      formData.set("rewardName", nextName)
      formData.set("rewardTerms", nextTerms)
      if (nextRequiresAgeCheck) formData.set("requiresAgeCheck", "on")
      saveInFlight.current = true
      setDirty(false)
      startTransition(() => action(formData))
    },
    [action, loyaltyCardId]
  )

  const save = useCallback(
    (
      nextEnabled: boolean,
      nextName: string,
      nextTerms: string,
      nextRequiresAgeCheck: boolean
    ) => {
      if (saveInFlight.current) {
        queuedSave.current = [
          nextEnabled,
          nextName,
          nextTerms,
          nextRequiresAgeCheck,
        ]
        return
      }
      dispatchSave(nextEnabled, nextName, nextTerms, nextRequiresAgeCheck)
    },
    [dispatchSave]
  )

  useEffect(() => {
    if (pending || !saveInFlight.current) return

    saveInFlight.current = false
    const queued = queuedSave.current
    queuedSave.current = null
    if (queued) dispatchSave(...queued)
  }, [dispatchSave, pending])

  useEffect(() => {
    if (!dirty || !enabled) return
    const timeout = window.setTimeout(
      () => save(enabled, rewardName, rewardTerms, requiresAgeCheck),
      600
    )
    return () => window.clearTimeout(timeout)
  }, [dirty, enabled, requiresAgeCheck, rewardName, rewardTerms, save])

  useEffect(() => {
    if (!state.saved || !state.fields) return
    savedValues.current = {
      enabled: state.fields.enabled ?? enabled,
      rewardName: state.fields.rewardName ?? rewardName,
      rewardTerms: state.fields.rewardTerms ?? rewardTerms,
      requiresAgeCheck: state.fields.requiresAgeCheck ?? requiresAgeCheck,
    }
  }, [
    enabled,
    requiresAgeCheck,
    rewardName,
    rewardTerms,
    state.fields,
    state.saved,
  ])

  useEffect(() => {
    if (!state.errors?.form) return
    setEnabled(savedValues.current.enabled)
    setRewardName(savedValues.current.rewardName)
    setRewardTerms(savedValues.current.rewardTerms)
    setRequiresAgeCheck(savedValues.current.requiresAgeCheck)
  }, [state.errors?.form])

  function handleToggle(next: boolean) {
    const nextName = next
      ? rewardName.trim()
        ? rewardName
        : template.rewardName
      : savedValues.current.rewardName
    const nextTerms = next
      ? rewardTerms.trim()
        ? rewardTerms
        : template.rewardTerms
      : savedValues.current.rewardTerms

    setEnabled(next)
    setRewardName(nextName)
    setRewardTerms(nextTerms)
    save(next, nextName, nextTerms, requiresAgeCheck)
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
      <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
      <ToggleRow
        name="enabled"
        label="Give a birthday treat"
        hint="Members with a saved birthday get this reward automatically during their birthday month."
        checked={enabled}
        disabled={pending}
        onChange={handleToggle}
      />

      <p
        className="mono-meta text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {pending
          ? "Saving birthday treat…"
          : state.saved
            ? state.message
            : "Changes save automatically"}
      </p>

      {state.errors?.form ? (
        <p className="text-sm text-destructive" role="alert">
          {state.errors.form}
        </p>
      ) : null}

      {enabled ? (
        <div className="grid gap-4">
          <Field
            id="birthday-reward-name"
            name="rewardName"
            label="Reward name"
            hint="What the member sees, e.g. “Birthday drink”."
            value={rewardName}
            onChange={(event) => {
              setRewardName(event.target.value)
              setDirty(true)
            }}
            onBlur={() =>
              save(enabled, rewardName, rewardTerms, requiresAgeCheck)
            }
            maxLength={100}
            disabled={pending}
            error={state.errors?.rewardName}
          />
          <ToggleRow
            name="requiresAgeCheck"
            label="Needs photo ID (18+)"
            hint="Switch this off when the birthday treat can be served without an age check."
            checked={requiresAgeCheck}
            disabled={pending}
            onChange={(checked) => {
              setRequiresAgeCheck(checked)
              save(enabled, rewardName, rewardTerms, checked)
            }}
          />
          <TextareaField
            id="birthday-reward-terms"
            name="rewardTerms"
            label="Reward terms"
            hint="12–500 characters. Anything the member should know before they redeem."
            value={rewardTerms}
            onChange={(event) => {
              setRewardTerms(event.target.value)
              setDirty(true)
            }}
            onBlur={() =>
              save(enabled, rewardName, rewardTerms, requiresAgeCheck)
            }
            maxLength={500}
            disabled={pending}
            error={state.errors?.rewardTerms}
          />
        </div>
      ) : (
        <>
          <input type="hidden" name="rewardName" value={rewardName} />
          <input type="hidden" name="rewardTerms" value={rewardTerms} />
        </>
      )}
    </form>
  )
}
