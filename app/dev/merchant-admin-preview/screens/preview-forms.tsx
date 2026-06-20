import type { ReactNode } from "react"

/**
 * Static, non-submitting equivalent of the admin server-action forms. The real
 * pages bind these to `"use server"` mutations (`adjustStampsAction`,
 * `setQrActiveAction`, …); the preview must not import those server modules, so
 * the form renders with the same Wet Ink chrome but no `action`, and callers
 * pass `disabled` submit buttons. The audited-action column layout/overflow is
 * still captured for the shell redesign proof.
 */
export function PreviewActionForm({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <form className={className}>{children}</form>
}
