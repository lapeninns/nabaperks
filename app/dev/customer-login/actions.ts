"use server"

import { notFound } from "next/navigation"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS } from "@/lib/customer/phone-code-email-fallback"
import { isEmailAddress } from "@/lib/customer/profile-fields"

const DISPLAY_OTP = "424242"

export async function submitLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  switch (data.get("intent")) {
    case "edit":
      return {
        fields: {
          contact: String(data.get("contact") ?? ""),
          editingContact: true,
          method: "phone",
        },
      }
    case "verify":
      return onPhone(await verifyLoginFixture(scenario, state, data))
    case "email-request":
      return requestEmailLoginFixture(scenario, state, data)
    case "email-verify":
      return verifyEmailLoginFixture(scenario, state, data)
    case "email-edit":
      return {
        fields: {
          method: "email",
          email: String(data.get("email") ?? ""),
          editingContact: true,
        },
      }
    case "switch-method":
      // No pending code cookie here: the real action returns to a phone code
      // still pending (covered by the live journey), this shows the number.
      return {
        fields: { method: data.get("method") === "email" ? "email" : "phone" },
      }
    default:
      return onPhone(await requestLoginFixture(scenario, state, data))
  }
}

function onPhone(state: CustomerLoginOtpState): CustomerLoginOtpState {
  return { ...state, fields: { ...state.fields, method: "phone" } }
}

/** Display-only actions: exercise the real form without sending codes or granting sessions. */
async function requestLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  const contact = String(data.get("contact") ?? "")
  if (!/^\+?\d{10,13}$/.test(contact)) {
    return {
      fields: { contact },
      errors: { contact: "Enter a valid phone number." },
    }
  }
  if (
    scenario === "send-error" ||
    (scenario === "resend-error" && state.fields?.otpSent)
  ) {
    return {
      fields: { contact, phoneSendFailed: true },
      errors: { form: "We couldn't send a code just now. Try again shortly." },
    }
  }
  return {
    fields: {
      contact,
      otpSent: true,
      emailFallbackInSeconds: PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS,
    },
    message:
      "If a code arrives for that number, enter it here. Otherwise scan a venue QR to join first.",
  }
}

async function verifyLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  const contact = String(data.get("contact") ?? "")
  // The real action works the wait out again from the pending code cookie;
  // the code step keeps counting down the wait it appeared with either way.
  const emailFallbackInSeconds = state.fields?.emailFallbackInSeconds
  if (scenario === "expired")
    return { errors: { contact: "Request a new phone code." } }
  if (scenario === "verify-error") {
    return {
      fields: { contact, otpSent: true, emailFallbackInSeconds },
      errors: {
        form: "We couldn't check that code. Try again or request a new one.",
      },
    }
  }
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      fields: { contact, otpSent: true, emailFallbackInSeconds },
      errors: { otp: "That code was not accepted." },
    }
  }
  return {
    fields: {
      contact,
      ...(scenario === "unknown" ? { noCards: true } : {}),
    },
    message:
      scenario === "unknown"
        ? "No cards found for that number yet. Scan a venue QR to join first."
        : "Display verification complete. No session was created.",
  }
}

/**
 * Email scenarios mirror app/home/login/email-actions.ts: `email-send-error`
 * (provider down), `email-unknown` (verified, no wallet), `email-expired`.
 */
async function requestEmailLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  const isResend = data.get("resend") === "1"
  const email = isResend
    ? (state.fields?.email ?? "")
    : String(data.get("email") ?? "")
        .trim()
        .toLowerCase()
  if (!isEmailAddress(email)) {
    return {
      fields: { method: "email", email },
      errors: { email: "Enter a valid email address." },
    }
  }
  if (scenario === "email-send-error") {
    return {
      fields: { method: "email", email },
      errors: {
        form: "Email codes are delayed. Try again shortly or use your phone.",
      },
    }
  }
  return {
    fields: {
      method: "email",
      email,
      otpSent: true,
      maskedEmail: `${email[0]}***@${email.split("@")[1]}`,
      retryAt: Math.floor(Date.now() / 1_000) + 60,
    },
    message: isResend
      ? "Use the latest code we sent."
      : "If a code arrives at that address, enter it here.",
  }
}

async function verifyEmailLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  const email = state.fields?.email
  if (scenario === "email-expired") {
    return {
      fields: { method: "email", email },
      errors: { email: "Request a new email code." },
    }
  }
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      fields: { ...state.fields, method: "email", otpSent: true },
      errors: { otp: "That code was not accepted." },
    }
  }
  return {
    fields: {
      method: "email",
      email,
      ...(scenario === "email-unknown" ? { noCards: true } : {}),
    },
    message:
      scenario === "email-unknown"
        ? "No wallet uses this email yet. Scan a venue QR to join, or sign in with your phone."
        : "Display verification complete. No session was created.",
  }
}
