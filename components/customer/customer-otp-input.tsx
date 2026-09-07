"use client"

import type { ComponentPropsWithoutRef } from "react"

import {
  normalizeOtpInput,
  otpFieldMaxLength,
} from "@/lib/customer/experience/otp-field"

/**
 * The one customer OTP field.
 *
 * Three surfaces ask a customer for a texted or emailed code — the join flow,
 * customer login, and the profile gate in front of a reward — and all three
 * hand-rolled the same `<input>`. They did not hand-roll it identically: only
 * the join form stripped non-digits on input, so a code pasted from a
 * messaging app with a trailing space or a "Your code is " prefix was accepted
 * there and silently rejected by the server on the other two (02#53).
 *
 * The normalisation is the whole point of the component, so it is not
 * optional. `maxLength` is the server-accepted cap from `otpFieldMaxLength`
 * rather than a hardcoded 6, and the truncation is applied to the normalised
 * digits so pasting a formatted code cannot lose its tail to a space.
 *
 * Presentation stays with the caller: `className` carries whichever input
 * class that surface already uses, because the profile gate's field sits on a
 * different ground from the other two. This component fixes what the field
 * *does*, not what it looks like.
 */
export function CustomerOtpInput({
  configuredLength,
  className,
  onInput,
  ...rest
}: Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "inputMode" | "autoComplete" | "maxLength"
> & {
  /** A known code length (a 4-digit dev code); clamped into the accepted range. */
  readonly configuredLength?: number
}) {
  const maxLength = otpFieldMaxLength(configuredLength)

  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={maxLength}
      className={className}
      onInput={(event) => {
        const digits = normalizeOtpInput(event.currentTarget.value).slice(
          0,
          maxLength
        )
        if (event.currentTarget.value !== digits) {
          event.currentTarget.value = digits
        }
        onInput?.(event)
      }}
    />
  )
}
