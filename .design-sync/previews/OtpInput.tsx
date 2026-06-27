import { OtpInput } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <OtpInput name="join-code" aria-label="Enter the code to join your stamp card" />
  </div>
)

export const FourDigit = () => (
  <div className="max-w-md">
    <OtpInput name="counter-pin" length={4} aria-label="Counter PIN" />
  </div>
)
