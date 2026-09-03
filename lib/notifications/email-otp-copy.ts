export type EmailOtpAudience =
  "customer" | "merchant-access" | "merchant-reset" | "merchant-verify"

export type EmailOtpCopy = {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly footer: string
  readonly subjectSuffix: string
  readonly textReason: string
}

export const emailOtpCopy = {
  customer: {
    eyebrow: "My Nabaperks",
    title: "Your verification code",
    intro: "Enter this code to open your cards. It expires shortly.",
    footer: "If you didn't request this, you can safely ignore this email.",
    subjectSuffix: "is your Nabaperks code",
    textReason: "open your Nabaperks cards",
  },
  "merchant-access": {
    eyebrow: "Nabaperks merchant",
    title: "Your venue sign-in code",
    intro: "Enter this code on Nabaperks to open your venue console.",
    footer:
      "If you did not request a Nabaperks sign-in code, you can ignore this email.",
    subjectSuffix: "is your Nabaperks sign-in code",
    textReason: "open your Nabaperks venue console",
  },
  "merchant-verify": {
    eyebrow: "Nabaperks merchant",
    title: "Verify your venue email",
    intro:
      "Enter this code on Nabaperks to confirm your email and finish creating your venue account.",
    footer:
      "If you did not start a Nabaperks venue signup, you can ignore this email.",
    subjectSuffix: "is your Nabaperks verification code",
    textReason: "confirm your Nabaperks venue email",
  },
  "merchant-reset": {
    eyebrow: "Nabaperks merchant",
    title: "Recover access to your venue",
    intro:
      "Enter this code on Nabaperks to recover access to your venue console.",
    footer: "If you did not ask to recover access, you can ignore this email.",
    subjectSuffix: "is your Nabaperks access recovery code",
    textReason: "recover access to your Nabaperks venue console",
  },
} satisfies Record<EmailOtpAudience, EmailOtpCopy>
