"use client"

import { useActionState, useEffect, useRef, type ReactNode } from "react"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
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
    // The inline banner renders INSIDE the record's disclosure, which may be
    // thousands of pixels down the page — and opening the next record closes
    // this one (that is what the shared accordion `name` is for), taking the
    // confirmation with it. A page-level toast means an audited mutation can
    // never complete with no perceivable confirmation. sonner's Toaster is
    // already mounted app-wide and themed via .cn-toast.
    if (state.status === "success" && state.message) {
      toast.success(state.message)
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message)
    }

    if (state.status !== "success") {
      return
    }

    // Bring the record back to the operator, and leave a mark on it (04#50).
    //
    // The toast above guarantees the outcome is *perceived*; it does not say
    // WHICH of a thousand records it belongs to, and by the time it fades the
    // operator may have opened another record — which closes this one, because
    // that is what the shared accordion `name` does.
    //
    // So: scroll this record's summary back into view, and stamp the summary
    // itself rather than anything inside the panel. The summary is the only
    // part that survives the disclosure being collapsed, so the mark is still
    // there when the operator comes back to it.
    const details = formRef.current?.closest("details")

    if (!details) {
      return
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    details.querySelector("summary")?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    })

    details.dataset.justUpdated = "true"

    const clear = window.setTimeout(() => {
      delete details.dataset.justUpdated
    }, 8000)

    return () => {
      window.clearTimeout(clear)
    }
  }, [state])

  return (
    <form
      ref={formRef}
      action={formAction}
      className={cn("grid gap-2", className)}
    >
      {children}
      {/* One banner recipe, not three hand-copies of it. StatusBanner pairs
          each tone with its semantic glyph, so an outcome reads as icon +
          colour + copy rather than colour alone. */}
      {state.status === "success" ? (
        <div role="status" aria-live="polite" className="grid gap-2">
          <StatusBanner tone="success" title={state.message} />
          {state.download ? (
            <Button asChild variant="secondary" size="sm" className="w-fit">
              <a
                download={state.download.filename}
                href={`data:${state.download.mimeType};charset=utf-8,${encodeURIComponent(
                  state.download.content
                )}`}
              >
                <Icon icon={Download01Icon} size={16} />
                Download customer data export
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
      {state.status === "error" ? (
        <div role="alert">
          <StatusBanner tone="error" title={state.message} />
        </div>
      ) : null}
    </form>
  )
}
