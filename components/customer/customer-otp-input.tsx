"use client"

import { customerOtpInputClass } from "@/components/customer/input-class"
import {
  normalizeOtpInput,
  otpFieldMaxLength,
} from "@/lib/customer/experience/otp-field"
import { cn } from "@/lib/utils"

/**
 * The one customer OTP field.
 *
 * Three surfaces rendered a one-time-code input and each behaved differently
 * (CUS 02#53): join stripped non-digits on input but set no `maxLength`; login
 * set `maxLength` but never stripped, so a pasted "123 456" stayed broken;
 * the profile gate did neither and used `profileInputClass + font-mono` instead
 * of the shared OTP register. Same task, three answers, one of them wrong
 * depending on how the member got the code onto the page.
 *
 * `normalizeOtpInput` and `otpFieldMaxLength` already existed in
 * `lib/customer/experience/otp-field` with unit tests; nothing here is new
 * behaviour, it is the same behaviour in one place.
 *
 * `join-otp-form.tsx` does NOT use this: `customer-join-frictionless-ux`
 * asserts `normalizeOtpInput` appears in that file, and moving the call behind
 * a component removes the literal. The join form was already the correct one of
 * the three, so this exists to fix the two that were not.
 *
 * Deliberately a native input, not `components/ui/input-otp`: DESIGN.md
 * requires a "single native input … one-time-code" and `ux-production-polish`
 * asserts it, so the six-cell primitive the finding asks for is out.
 */
export function CustomerOtpInput({
  id,
  name = "otp",
  invalid,
  describedBy,
  autoFocus,
  configuredLength,
  className,
  onFocus,
}: {
  readonly id: string
  readonly name?: string
  readonly invalid?: boolean
  readonly describedBy?: string
  readonly autoFocus?: boolean
  /** Server-configured code length, clamped by `otpFieldMaxLength`. */
  readonly configuredLength?: number
  readonly className?: string
  readonly onFocus?: React.FocusEventHandler<HTMLInputElement>
}) {
  const maxLength = otpFieldMaxLength(configuredLength)

  return (
    <input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={maxLength}
      className={cn(customerOtpInputClass, className)}
      aria-invalid={Boolean(invalid)}
      aria-describedby={describedBy}
      onFocus={onFocus}
      onInput={(event) => {
        // Paste is the common path — a member copies "123 456" out of a text
        // message. Strip to digits and clamp here so every surface treats that
        // paste the same way.
        const digits = normalizeOtpInput(event.currentTarget.value).slice(
          0,
          maxLength
        )

        if (event.currentTarget.value !== digits) {
          event.currentTarget.value = digits
        }
      }}
    />
  )
}
