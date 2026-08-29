"use client"

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
} from "react"

import { Eyebrow } from "@/components/brand"
import { cn } from "@/lib/utils"

type DescribedControl = {
  id?: string
  "aria-describedby"?: string
}

/**
 * The admin console's compact field. Its own file, and a client component,
 * purely so it can call `useId` — `support.tsx` is a server module, and without
 * a generated id there is no way to bind a helper to a control that two
 * different fields on the same page might both call "Reason" (ADM 04#47).
 *
 * History: the helper used to sit INSIDE the `<label>`, so a screen reader read
 * "DELTA POSITIVE ADDS STAMPS, NEGATIVE REMOVES THEM" as the *name* of the
 * number input. Moving it out fixed the name and left it associated with
 * nothing at all — announced as loose text, or not at all. It is now a real
 * description via `aria-describedby`.
 *
 * The lane recorded full wiring as needing per-field ids through ~20 call
 * sites. It does not: the id is generated here and injected into the control,
 * so all 79 call sites are unchanged.
 *
 * Not folded into `FormField`, which is what the finding proposes, because
 * `FieldDescription` is `text-sm` against this helper's `text-xs` and
 * `FieldLabel` is not the compact `Eyebrow`. That is a visual change across
 * every admin form and belongs with the other baseline decisions.
 */
export function AdminField({
  label,
  children,
  helper,
  className,
}: {
  label: ReactNode
  children: ReactNode
  helper?: ReactNode
  className?: string
}) {
  const helperId = useId()
  const control = Children.toArray(children)
  const single = control.length === 1 ? control[0] : null

  // Multi-element children keep their own wiring, exactly as FormField does:
  // guessing which of several nodes is the control is how a describedby ends
  // up on a wrapper and the input keeps nothing.
  const described =
    helper && single && isValidElement<DescribedControl>(single)
      ? cloneElement(single, {
          "aria-describedby": single.props["aria-describedby"] ?? helperId,
        })
      : children

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label className="grid min-w-0 gap-1.5 text-sm font-bold">
        <Eyebrow>{label}</Eyebrow>
        {described}
      </label>
      {helper ? (
        // whitespace-normal: inside a table cell the helper would inherit the
        // cell's nowrap, and its single-line min-content inflates the field's
        // implicit track (the Delta/Reason overlap class of bug).
        <span
          id={helperId}
          className="text-xs leading-5 font-normal whitespace-normal text-muted-foreground"
        >
          {helper}
        </span>
      ) : null}
    </div>
  )
}
