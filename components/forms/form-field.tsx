"use client"

import {
  Children,
  cloneElement,
  isValidElement,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

type ControlAriaProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: AriaAttributes["aria-invalid"]
}

/**
 * The one input story: label + control + optional description/error, with the
 * accessibility contract actually wired. When `children` is a single element
 * (the normal case — an `Input`, `Textarea`, or select), FormField clones it
 * and injects:
 *
 * - `id` (unless the control already set one), so the label's `htmlFor` binds;
 * - `aria-describedby` pointing at the description and error nodes;
 * - `aria-invalid` when an error is present, which also triggers the
 *   destructive border state in the unlayered Wet Ink layer.
 *
 * Multi-element children render untouched (the caller owns the wiring).
 */
export function FormField({
  id,
  label,
  description,
  error,
  trailing,
  children,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  /**
   * Control affixed inside the field well (a password reveal toggle).
   *
   * It has to be a SIBLING of the control rather than a wrapper around it:
   * `wireControl` clones the single child to inject `id`, `aria-describedby`
   * and `aria-invalid`, so wrapping the input in a positioning element sends
   * that wiring to the wrapper and leaves the input with no accessible name at
   * all. Caught by auth-password-policy in the browser, not by any static test.
   */
  trailing?: ReactNode
  children: ReactNode
}) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {trailing ? (
        <span className="relative block min-w-0">
          {wireControl(children, { id, descriptionId, errorId, error })}
          {trailing}
        </span>
      ) : (
        wireControl(children, { id, descriptionId, errorId, error })
      )}
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FormMessage id={errorId}>{error}</FormMessage> : null}
    </Field>
  )
}

function wireControl(
  children: ReactNode,
  {
    id,
    descriptionId,
    errorId,
    error,
  }: {
    id: string
    descriptionId?: string
    errorId?: string
    error?: ReactNode
  }
): ReactNode {
  if (Children.count(children) !== 1 || !isValidElement(children)) {
    return children
  }

  const control = children as ReactElement<ControlAriaProps>
  const describedBy =
    [control.props["aria-describedby"], descriptionId, errorId]
      .filter(Boolean)
      .join(" ") || undefined

  return cloneElement(control, {
    id: control.props.id ?? id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : control.props["aria-invalid"],
  })
}

export function FormMessage({
  id,
  children,
}: {
  id?: string
  children: ReactNode
}) {
  return <FieldError id={id}>{children}</FieldError>
}
