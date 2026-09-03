export type SendEmailAction = {
  readonly audience: "merchant-access" | "merchant-reset" | "merchant-verify"
  readonly purpose: "recovery" | "signup"
  readonly recordsAccountCreation: boolean
}

const SEND_EMAIL_ACTIONS = new Map<string, SendEmailAction>([
  [
    "signup",
    {
      audience: "merchant-verify",
      purpose: "signup",
      recordsAccountCreation: true,
    },
  ],
  [
    "magiclink",
    {
      audience: "merchant-access",
      // Existing-user passwordless codes share the long-standing alias namespace
      // consumed by the sign-in verifier. The audience—not the alias purpose—is
      // what distinguishes the message from a genuine account-creation email.
      purpose: "signup",
      recordsAccountCreation: false,
    },
  ],
  [
    "recovery",
    {
      audience: "merchant-reset",
      purpose: "recovery",
      recordsAccountCreation: false,
    },
  ],
])

export function classifySendEmailAction(
  action: string | undefined
): SendEmailAction | null {
  if (!action) return null
  return SEND_EMAIL_ACTIONS.get(action) ?? null
}
