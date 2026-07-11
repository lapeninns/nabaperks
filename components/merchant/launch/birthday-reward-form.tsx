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
} from "@/components/merchant/loyalty-card-form"
import type { BirthdayRewardTemplate } from "@/lib/merchant/birthday-reward-template"

const initialState: BirthdayRewardActionState = {}
type BirthdayRewardSaveAction = (
  state: BirthdayRewardActionState,
  formData: FormData
) => Promise<BirthdayRewardActionState>

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
  }
  template: BirthdayRewardTemplate
  saveAction?: BirthdayRewardSaveAction
}) {
  const [state, action, pending] = useActionState(
    saveAction,
    initialState
  )
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
  const savedValues = useRef(initialValues)

  const save = useCallback(
    (nextEnabled: boolean, nextName: string, nextTerms: string) => {
      const formData = new FormData()
      formData.set("loyaltyCardId", loyaltyCardId)
      if (nextEnabled) formData.set("enabled", "on")
      formData.set("rewardName", nextName)
      formData.set("rewardTerms", nextTerms)
      setDirty(false)
      startTransition(() => action(formData))
    },
    [action, loyaltyCardId]
  )

  useEffect(() => {
    if (!dirty || !enabled) return
    const timeout = window.setTimeout(
      () => save(enabled, rewardName, rewardTerms),
      600
    )
    return () => window.clearTimeout(timeout)
  }, [dirty, enabled, rewardName, rewardTerms, save])

  useEffect(() => {
    if (!state.saved || !state.fields) return
    savedValues.current = {
      enabled: state.fields.enabled ?? enabled,
      rewardName: state.fields.rewardName ?? rewardName,
      rewardTerms: state.fields.rewardTerms ?? rewardTerms,
    }
  }, [enabled, rewardName, rewardTerms, state.fields, state.saved])

  useEffect(() => {
    if (!state.errors?.form) return
    setEnabled(savedValues.current.enabled)
    setRewardName(savedValues.current.rewardName)
    setRewardTerms(savedValues.current.rewardTerms)
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
    save(next, nextName, nextTerms)
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
            onBlur={() => save(enabled, rewardName, rewardTerms)}
            maxLength={100}
            error={state.errors?.rewardName}
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
            onBlur={() => save(enabled, rewardName, rewardTerms)}
            maxLength={500}
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
