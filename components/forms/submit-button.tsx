"use client"

import type { ComponentProps, ReactNode } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  /**
   * Copy shown while the surrounding form's server action is in flight,
   * e.g. "Saving…". Use a real ellipsis (…), never three dots. Falls back to
   * the resting children so the button never blanks.
   */
  pendingLabel?: ReactNode
}

/**
 * THE pending-state recipe for server-action forms: drop this in place of a
 * bare `<Button type="submit">` inside any `<form action={…}>` and the button
 * disables itself, announces `aria-busy`, swaps to the Spinner plus
 * `pendingLabel` while the action runs, and exposes `data-pending` for
 * styling hooks. All Button variants/sizes pass through unchanged.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      data-pending={pending ? "true" : undefined}
      {...props}
    >
      {pending ? (
        <>
          <Spinner aria-hidden="true" role="presentation" aria-label={undefined} />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
