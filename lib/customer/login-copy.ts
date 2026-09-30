/**
 * Returning sign-in (/home/login) in the same words as joining, so a guest
 * learns the pattern once: "Open my cards", the mobile number, "Send my
 * code", "Your code", "Continue". Pure, so the page, the DB-free harness and
 * tests share one source.
 *
 * Phone is the only way in. Email appears only as the phone code's fallback,
 * behind the server gate in `lib/customer/email-fallback.ts`; nothing here
 * offers it as a first choice.
 */
import type { OtpChannel } from "@/lib/customer/otp-channel-core"

export const LOGIN_COPY = {
  headline: "Open my cards",
  support: "Enter the mobile number you use with Nabaperks.",
  phoneLabel: "UK mobile number",
  phonePlaceholder: "07700 900123",
  phoneHint: "We'll send you a code to confirm it's you.",
  send: "Send my code",
  codeHeadline: "Enter your code",
  codeLabel: "Your code",
  codeHint: "Paste or type the code from the message.",
  continue: "Continue",
  resend: "Send a new code",
  changeNumber: "Wrong number? Change it",
  newHere: "New here? Scan the QR at a venue to get your first stamp.",
  noCardsPhone: "We couldn't find any cards for this number.",
  noCardsEmail: "No card uses this email",
  noCardsSupport: "Scan the QR at a venue to get your first stamp.",
  tryDifferentNumber: "Try a different number",
  emailFallback: "Get a code by email instead",
  emailSend: "Send code by email",
  emailSupport:
    "Useful when there's no mobile signal. Works on the venue's Wi-Fi.",
  emailCodeLabel: "Your code",
  emailResend: "Send a new code",
  changeEmail: "Change email",
  backToPhone: "Back to the text code",
  useMobile: "Use my mobile number",
} as const

/** Server answers for the phone steps, in the guest's words. */
export const LOGIN_MESSAGES = {
  sendFailed: "We couldn't send a code just now. Try again.",
  codeExpired: "Your code expired. Send a new one.",
  codeMalformed: "Enter the code we sent you.",
  tooManyTries: "Too many tries. Send a new code in a few minutes.",
  checkFailed: "We couldn't check that code. Try again, or send a new code.",
  codeRejected: "That code didn't work. Check it and try again.",
  // A send the admission may have refused without saying so: never claims one went.
  newCodeSent: "If a new code arrives, use the latest one.",
  signInFailed:
    "We couldn't finish signing you in. Send a new code and try again.",
} as const

const CHANNEL_WORD: Record<OtpChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "text",
}

/**
 * A UK mobile in E.164 as the guest knows it, masked: +447700900123 becomes
 * "07•••• ••123". Anything else keeps only its last three digits.
 */
export function maskedMobile(e164: string): string {
  const digits = e164.replace(/\D/g, "")
  const last3 = digits.slice(-3)
  if (e164.startsWith("+44") && digits.length === 12) {
    return `0${digits[2]}•••• ••${last3}`
  }
  return `the number ending ${last3}`
}

/**
 * The number field's prefill after "Wrong number? Change it": the stored
 * E.164 "+447700900123" as the guest typed it, "07700 900123", as the join
 * page prefills it (designer brief J3). Anything else, such as a number the
 * guest is still correcting, is shown as it was typed.
 */
export function loginPhonePrefill(contact: string): string {
  const match = /^\+44(7\d{9})$/.exec(contact)
  if (!match) return contact
  const national = `0${match[1]}`
  return `${national.slice(0, 5)} ${national.slice(5)}`
}

/** "Sent by WhatsApp to 07•••• ••123." The real channel, never a promise. */
export function loginCodeSentLine(
  contact: string,
  channel: OtpChannel | undefined
): string {
  const to = maskedMobile(contact)
  return channel
    ? `Sent by ${CHANNEL_WORD[channel]} to ${to}.`
    : `Sent to ${to}.`
}

export type LoginHeadingInput = {
  readonly method: "phone" | "email"
  readonly noCards: boolean
  readonly otpSent: boolean
  readonly contact?: string
  readonly channel?: OtpChannel
  readonly maskedEmail?: string
}

/** The headline and support line for the current sign-in step. */
export function loginHeading(input: LoginHeadingInput): {
  readonly title: string
  readonly body: string
} {
  const byEmail = input.method === "email"
  if (input.noCards) {
    return {
      title: byEmail ? LOGIN_COPY.noCardsEmail : LOGIN_COPY.noCardsPhone,
      body: LOGIN_COPY.noCardsSupport,
    }
  }
  if (input.otpSent) {
    return {
      title: LOGIN_COPY.codeHeadline,
      body: byEmail
        ? input.maskedEmail
          ? `Sent to ${input.maskedEmail}.`
          : "Check your email for the code."
        : loginCodeSentLine(input.contact ?? "", input.channel),
    }
  }
  if (byEmail) {
    return {
      title: "Get your code by email",
      body: LOGIN_COPY.emailSupport,
    }
  }
  return { title: LOGIN_COPY.headline, body: LOGIN_COPY.support }
}
