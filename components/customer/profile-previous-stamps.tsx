import type { ReactNode } from "react"

import { SectionHeader } from "@/components/brand"
import { CustomerProfileAddPhone } from "@/components/customer/profile-add-phone"
import { CustomerProfilePreviousStampsEmail } from "@/components/customer/profile-previous-stamps-email"
import {
  PREVIOUS_STAMPS_COPY,
  PREVIOUS_STAMPS_RETURN_TO,
  PREVIOUS_STAMPS_SECTION_ID,
  type PreviousStampsMethod,
} from "@/lib/customer/previous-stamps"

/**
 * The optional "Find my previous stamps" task on the profile, kept apart from
 * the contact forms so they never explain linking rules. `method` is decided
 * on the server (`previousStampsMethod`) from what this card has confirmed;
 * the task stays closed until the guest opens it. The home suggestion links
 * here by `#previous-stamps`.
 *
 * `form` overrides the default form for the method (the DB-free harness
 * passes its fixture actions).
 */
export function CustomerProfilePreviousStamps({
  method,
  form,
  notice,
}: {
  method: PreviousStampsMethod
  form?: ReactNode
  /** An outcome the task redirected back with (`?contact=`). */
  notice?: ReactNode
}) {
  const copy = PREVIOUS_STAMPS_COPY
  const task =
    form ??
    (method === "phone" ? (
      <CustomerProfileAddPhone
        variant="previous"
        returnTo={PREVIOUS_STAMPS_RETURN_TO}
      />
    ) : method === "email" ? (
      <CustomerProfilePreviousStampsEmail
        returnTo={PREVIOUS_STAMPS_RETURN_TO}
      />
    ) : null)

  return (
    <section
      id={PREVIOUS_STAMPS_SECTION_ID}
      className="surface-card grid gap-4 p-5"
      data-previous-stamps={method}
    >
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
      {notice}
      <p className="text-sm leading-6 text-muted-foreground">
        {copy.intro[method]}
      </p>
      {task ? (
        <details className="group grid gap-3">
          <summary className="focus-ring inline-flex min-h-11 cursor-pointer list-none items-center font-bold underline underline-offset-4 [&::-webkit-details-marker]:hidden">
            {copy.action}
          </summary>
          <div className="pt-3">{task}</div>
        </details>
      ) : null}
    </section>
  )
}
