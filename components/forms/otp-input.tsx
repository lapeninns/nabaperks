"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export function OtpInput({
  name = "otp",
  length = 6,
  "aria-label": ariaLabel = "One-time passcode",
}: {
  name?: string
  length?: number
  "aria-label"?: string
}) {
  return (
    <InputOTP
      name={name}
      maxLength={length}
      aria-label={ariaLabel}
      inputMode="numeric"
      autoComplete="one-time-code"
    >
      <InputOTPGroup>
        {Array.from({ length }).map((_, index) => (
          <InputOTPSlot key={index} index={index} className="size-11 text-base font-bold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
