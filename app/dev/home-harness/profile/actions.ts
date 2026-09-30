"use server"

import { notFound } from "next/navigation"

import type { EmailPromptState } from "@/app/home/(authed)/profile/actions"
import type { ProfilePhoneState } from "@/app/home/(authed)/profile/phone-actions"
import {
  PREVIOUS_STAMPS_COPY,
  walletLinkFailureCopy,
  walletLinkedMessage,
} from "@/lib/customer/previous-stamps"

const DISPLAY_OTP = "424242"
/** A number another fixture card "holds", for the conflict answer. */
const HELD_PHONE = "07700900999"
/** A number whose add "fails" its audit write, so it is taken off again. */
const UNAUDITED_PHONE = "07700900998"
/** Numbers whose code brings a card together, or asks for sign-in or staff. */
const LINKED_PHONE = "07700900997"
const REAUTHENTICATE_PHONE = "07700900996"
const REVIEW_PHONE = "07700900995"
/** A number whose code has lapsed by the time it is entered. */
const EXPIRED_PHONE = "07700900994"

/**
 * Display-only stand-in for profilePhoneAction: exercises the real "add your
 * mobile number" form (Contact, and the previous-stamps task) without
 * sending a code or changing a card. Every answer that returns to the number
 * keeps it, as the real action does.
 */
export async function harnessProfilePhoneAction(
  state: ProfilePhoneState,
  data: FormData
): Promise<ProfilePhoneState> {
  if (process.env.NODE_ENV === "production") notFound()
  const intent = data.get("intent")
  const phone = String(data.get("phone") ?? "").replace(/\s/g, "")
  if (intent === "edit") return { step: "phone", phone }
  if (intent === "verify") return verifyFixture(state, data)
  if (!/^0\d{10}$/.test(phone)) {
    return {
      step: "phone",
      phone,
      errors: { phone: "Enter a UK mobile number, like 07700 900123." },
    }
  }
  // As if WhatsApp is the primary channel; "Text me instead" resends by SMS.
  return {
    step: "code",
    phone,
    channel: data.get("channel") === "sms" ? "sms" : "whatsapp",
    message: "If a code arrives for that number, enter it here.",
  }
}

function verifyFixture(
  state: ProfilePhoneState,
  data: FormData
): ProfilePhoneState {
  const phone = state.phone
  // A wrong code keeps the code step, as the real action does.
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      step: "code",
      phone,
      channel: state.channel,
      errors: { otp: "That code didn't work. Check it and try again." },
    }
  }
  if (phone === EXPIRED_PHONE) {
    return {
      step: "phone",
      phone,
      errors: { phone: "Your code expired. Send a new one." },
    }
  }
  if (phone === UNAUDITED_PHONE) {
    return {
      step: "phone",
      phone,
      errors: {
        form: "We couldn't save your number just now. Send a new code and try again.",
      },
    }
  }
  if (phone === LINKED_PHONE) {
    return {
      step: "attached",
      walletLinked: true,
      message: walletLinkedMessage(false),
    }
  }
  if (phone === REAUTHENTICATE_PHONE || phone === REVIEW_PHONE) {
    const recovery =
      phone === REAUTHENTICATE_PHONE ? "reauthenticate" : "requires_review"
    return {
      step: "phone",
      phone,
      recovery,
      errors: { form: walletLinkFailureCopy(recovery, "phone") },
    }
  }
  if (phone === HELD_PHONE) {
    return {
      step: "phone",
      phone,
      errors: { form: walletLinkFailureCopy("conflict", "phone") },
    }
  }
  return {
    step: "attached",
    message: "Your mobile number is confirmed. You can use it to sign in.",
  }
}

/**
 * Display-only stand-in for previousStampsEmailAction. The address picks the
 * outcome after the display code: `linked@`, `again@` (sign in again),
 * `review@` (staff), `held@` (used by another card); anything else is
 * confirmed with nothing to bring over.
 */
export async function harnessPreviousStampsEmailAction(
  state: EmailPromptState,
  data: FormData
): Promise<EmailPromptState> {
  if (process.env.NODE_ENV === "production") notFound()
  const intent = data.get("intent")
  if (intent === "change") return { step: "email", email: state.email }
  if (intent !== "verify") {
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return {
        step: "email",
        email,
        errors: { email: "Enter a valid email address." },
      }
    }
    return {
      step: "code",
      email,
      message: "Enter the code we sent to your email.",
    }
  }
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      step: "code",
      email: state.email,
      errors: { otp: "That code didn't work. Check it and try again." },
    }
  }
  const local = state.email?.split("@")[0]
  if (local === "linked") {
    return {
      step: "verified",
      walletLinked: true,
      message: walletLinkedMessage(false),
    }
  }
  if (local === "again" || local === "review") {
    const recovery = local === "again" ? "reauthenticate" : "requires_review"
    return {
      step: "email",
      recovery,
      errors: { form: walletLinkFailureCopy(recovery, "email") },
    }
  }
  if (local === "held") {
    return {
      step: "email",
      errors: { form: walletLinkFailureCopy("conflict", "email") },
    }
  }
  return { step: "verified", message: PREVIOUS_STAMPS_COPY.nothingFound.email }
}
