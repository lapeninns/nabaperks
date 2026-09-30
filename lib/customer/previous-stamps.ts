/**
 * "Find my previous stamps": the guest-facing side of verified wallet linking
 * (`public.link_verified_customer_wallets`, called only from
 * `lib/customer/wallet-link.ts`). Pure, so the profile, the reward gate and the
 * dev harness lanes read the same decisions and copy.
 *
 * Linking runs in one direction only. A card with a confirmed email and no
 * confirmed phone joins a card with a confirmed phone and no confirmed email,
 * after the guest proves the other contact with a fresh code. So the task asks
 * for whichever contact this card is missing:
 *
 * - no confirmed mobile number: confirm the other number (the phone attach
 *   flow, which links when another card holds that number);
 * - a mobile number but no confirmed email: confirm the other email (the email
 *   confirmation flow, which links the same way);
 * - both confirmed: nothing can be brought together automatically, so the
 *   guest is pointed to staff. No screen ever shows another card's balances
 *   before ownership is proven.
 */
import { safeNextPath } from "@/lib/navigation/safe-next-path"

export type PreviousStampsMethod = "phone" | "email" | "staff"

export type WalletLinkOutcome =
  "conflict" | "reauthenticate" | "requires_review"

export type WalletLinkRecovery = Exclude<WalletLinkOutcome, "conflict">

export function previousStampsMethod(contacts: {
  readonly phoneVerified: boolean
  readonly emailVerified: boolean
}): PreviousStampsMethod {
  if (!contacts.phoneVerified) return "phone"
  if (!contacts.emailVerified) return "email"
  return "staff"
}

export const PREVIOUS_STAMPS_COPY = {
  eyebrow: "Optional",
  title: "Previous stamps",
  action: "Find my previous stamps",
  intro: {
    phone:
      "Had stamps under another mobile number? Confirm the other number and we'll bring its stamps here.",
    email:
      "Had stamps under an email? Confirm the other email and we'll bring its stamps here. It is also saved as your email.",
    staff:
      "Your mobile number and email are both confirmed. If you had stamps under a different number or email, ask staff at a venue for help.",
  },
  phoneTitle: "Confirm the other number",
  emailTitle: "Confirm the other email",
  emailLabel: "Email address",
  emailSend: "Send my code",
  codeLabel: "Your code",
  codeContinue: "Continue",
  resend: "Send a new code",
  changeEmail: "Change email",
  /** A proven contact that no other card held: nothing to bring over. */
  nothingFound: {
    phone: "Number confirmed. There were no other stamps to bring here.",
    email: "Email confirmed. There were no other stamps to bring here.",
  },
} as const satisfies {
  eyebrow: string
  title: string
  action: string
  intro: Record<PreviousStampsMethod, string>
  phoneTitle: string
  emailTitle: string
  emailLabel: string
  emailSend: string
  codeLabel: string
  codeContinue: string
  resend: string
  changeEmail: string
  nothingFound: Record<"phone" | "email", string>
}

export const STAMPS_TOGETHER_HEADLINE = "Your stamps are together now."

/**
 * After two cards are brought together. The surviving card always holds the
 * confirmed mobile number, so that is how the guest signs in. Email is only
 * mentioned while the email fallback can deliver a code
 * (`CUSTOMER_EMAIL_AUTH_MODE` not `off`), and never as a way in on its own.
 */
export function walletLinkedMessage(emailFallbackEnabled: boolean): string {
  return emailFallbackEnabled
    ? `${STAMPS_TOGETHER_HEADLINE} Sign in with your mobile number. If a code can't reach you, you can get one by email.`
    : `${STAMPS_TOGETHER_HEADLINE} Sign in with your mobile number.`
}

/** The guest's words for a link that did not happen. Discloses nothing. */
export function walletLinkFailureCopy(
  outcome: WalletLinkOutcome,
  method: "phone" | "email" = "phone"
): string {
  switch (outcome) {
    case "reauthenticate":
      return method === "phone"
        ? "For your security, sign in again, then confirm the other number."
        : "For your security, sign in again, then confirm the other email."
    case "requires_review":
      return "We can't bring these together automatically. Your stamps haven't changed. Ask staff at a venue for help."
    case "conflict":
      return method === "phone"
        ? "This number is used by another card. Sign in with that number, or ask staff for help."
        : "This email is used by another card. Use a different email, or ask staff for help."
  }
}

export const DEFAULT_WALLET_LINK_RETURN_TO = "/home/profile"

/**
 * Where "Sign in again" returns the guest: a same-origin, root-relative path
 * (the reward they were setting up, for example), or the profile by default.
 * The session reset action validates it again on the server.
 */
export function walletLinkReturnTo(raw: string | null | undefined): string {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return DEFAULT_WALLET_LINK_RETURN_TO
  const safe = safeNextPath(value)
  // safeNextPath falls back to /home for anything unsafe.
  return safe === "/home" && value !== "/home"
    ? DEFAULT_WALLET_LINK_RETURN_TO
    : safe
}

/**
 * A confirmation that must outlive the form that produced it: on the reward
 * gate, adding a phone moves the gate past its phone step, which unmounts the
 * form, so the action redirects back with this flag instead.
 */
export const CONTACT_NOTICE_PARAM = "contact"

export type ContactNotice =
  | "phone-added"
  | "stamps-together"
  | "nothing-found-phone"
  | "nothing-found-email"

export const CONTACT_NOTICE_COPY: Record<
  ContactNotice,
  { readonly title: string; readonly body: string }
> = {
  "phone-added": {
    title: "Mobile number confirmed",
    body: "You can use it to sign in.",
  },
  "stamps-together": {
    title: STAMPS_TOGETHER_HEADLINE,
    body: "Sign in with your mobile number.",
  },
  "nothing-found-phone": {
    title: "Mobile number confirmed",
    body: "There were no other stamps to bring here.",
  },
  "nothing-found-email": {
    title: "Email confirmed",
    body: "There were no other stamps to bring here.",
  },
}

const CONTACT_NOTICES = Object.keys(CONTACT_NOTICE_COPY) as ContactNotice[]

/** What the server says is confirmed for the signed-in guest right now. */
export type ConfirmedContacts = {
  readonly phone: boolean
  readonly email: boolean
}

/**
 * The flag alone is not proof: a shared or crafted link could carry it. Each
 * notice shows only when the server state it describes is true now, so a
 * guest is never told a number or email is confirmed when it is not.
 */
function noticeMatchesState(
  notice: ContactNotice,
  confirmed: ConfirmedContacts
): boolean {
  switch (notice) {
    case "phone-added":
    case "nothing-found-phone":
      return confirmed.phone
    case "nothing-found-email":
      return confirmed.email
    case "stamps-together":
      return confirmed.phone || confirmed.email
  }
}

export function contactNoticeFromParam(
  value: string | string[] | null | undefined,
  confirmed: ConfirmedContacts
): ContactNotice | null {
  const single = Array.isArray(value) ? value[0] : value
  const notice = CONTACT_NOTICES.find((candidate) => candidate === single)
  return notice && noticeMatchesState(notice, confirmed) ? notice : null
}

/** The id of the profile's previous-stamps section, its link anchor. */
export const PREVIOUS_STAMPS_SECTION_ID = "previous-stamps"

/** The profile's previous-stamps task, where its outcomes come back to. */
export const PREVIOUS_STAMPS_RETURN_TO = `/home/profile#${PREVIOUS_STAMPS_SECTION_ID}`

/** `returnTo` with the notice flag set, keeping its own query and hash. */
export function contactNoticeHref(
  returnTo: string,
  notice: ContactNotice
): string {
  const base = walletLinkReturnTo(returnTo)
  const url = new URL(base, "https://nabaperks.local")
  url.searchParams.set(CONTACT_NOTICE_PARAM, notice)
  return `${url.pathname}${url.search}${url.hash}`
}
