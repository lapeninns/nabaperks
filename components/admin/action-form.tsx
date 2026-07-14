"use client"

import { useActionState, useEffect, useRef, type ReactNode } from "react"

import {
  idleAdminActionState,
  type AdminActionState,
} from "@/lib/admin/action-state"
import { cn } from "@/lib/utils"

export type AdminAction = (
  state: AdminActionState,
  formData: FormData
) => Promise<AdminActionState>

/**
 * The one form wrapper for audited admin actions
 * (platform ux production polish): pairs a structured-state server action
 * with `useActionState` so the outcome renders inline next to the submit
 * control instead of throwing into the segment error boundary. Pending state
 * comes from the shared `SubmitButton` placed in `children`.
 *
 * On success the fields reset (the typed reason should not linger); on error
 * nothing resets, so the operator's typed context survives the failure.
 */
export function AdminActionForm({
  action,
  children,
  className,
}: {
  readonly action: AdminAction
  readonly children: ReactNode
  readonly className?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(action, idleAdminActionState)

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className={cn("grid gap-2", className)}>
      {children}
      {state.status === "success" ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border-2 border-ink bg-reward/12 px-3 py-2 text-sm font-semibold text-foreground"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.download ? (
        <a
          download={state.download.filename}
          href={`data:${state.download.mimeType};charset=utf-8,${encodeURIComponent(
            state.download.content
          )}`}
          className="inline-flex w-fit items-center gap-2 rounded-lg border-2 border-ink bg-reward/12 px-3 py-2 text-sm font-semibold text-foreground underline decoration-2 underline-offset-2 hover:bg-reward/20"
        >
          Download customer data export
        </a>
      ) : null}
      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-lg border-2 border-ink bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-strong"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
