"use server"

import { notFound } from "next/navigation"

import type { ProfilePhoneState } from "@/app/home/(authed)/profile/phone-actions"

const DISPLAY_OTP = "424242"
/** A number another fixture wallet "holds", for the conflict answer. */
const HELD_PHONE = "07700900999"
/** A number whose add "fails" its audit write, so it is taken off again. */
const UNAUDITED_PHONE = "07700900998"

/**
 * Display-only stand-in for profilePhoneAction: exercises the real "add a
 * phone number" form without sending a code or changing a wallet.
 */
export async function harnessProfilePhoneAction(
  state: ProfilePhoneState,
  data: FormData
): Promise<ProfilePhoneState> {
  if (process.env.NODE_ENV === "production") notFound()
  const intent = data.get("intent")
  const phone = String(data.get("phone") ?? "").replace(/\s/g, "")
  if (intent === "edit") return { step: "phone", phone }
  if (intent === "verify") {
    if (data.get("otp") !== DISPLAY_OTP) {
      return {
        step: "code",
        phone: state.phone,
        errors: { otp: "That code was not accepted." },
      }
    }
    if (state.phone === UNAUDITED_PHONE) {
      return {
        step: "phone",
        phone: state.phone,
        errors: {
          form: "We couldn't add this phone number just now. Try again shortly.",
        },
      }
    }
    return state.phone === HELD_PHONE
      ? {
          step: "phone",
          errors: {
            form: "This phone number is already used by another Nabaperks wallet. Sign in with that number, or ask the venue for help.",
          },
        }
      : {
          step: "attached",
          message: "Your phone number is added. You can sign in with it too.",
        }
  }
  if (!/^0\d{10}$/.test(phone)) {
    return {
      step: "phone",
      phone,
      errors: { phone: "Enter a valid phone number." },
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
