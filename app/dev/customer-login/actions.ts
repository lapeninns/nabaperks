"use server"

import { notFound } from "next/navigation"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { LOGIN_MESSAGES } from "@/lib/customer/login-copy"
import { parseOtpChannel } from "@/lib/customer/otp-channel-core"
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
      errors: { contact: "Enter a UK mobile number, like 07700 900123." },
    }
  }
  // As the real action stores it: E.164, so the code step masks it the same.
  const e164 = /^0\d{10}$/.test(contact) ? `+44${contact.slice(1)}` : contact
  if (
    scenario === "send-error" ||
    (scenario === "resend-error" && state.fields?.otpSent)
  ) {
    return {
      fields: { contact: e164, phoneSendFailed: true },
      errors: { form: LOGIN_MESSAGES.sendFailed },
    }
  }
  return {
    fields: {
      contact: e164,
      otpSent: true,
      // As if WhatsApp is the primary channel; "Text me instead" sends SMS.
      channel: parseOtpChannel(data.get("channel")) ?? "whatsapp",
      emailFallbackInSeconds: PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS,
      // Each send is newer than the last, as the pending cookie's issue time
      // is, so a resend restarts the email fallback's wait.
      phoneCodeSentAt: Math.max(
        Math.floor(Date.now() / 1_000),
        (state.fields?.phoneCodeSentAt ?? 0) + 1
      ),
    },
    ...(data.get("resend") === "1"
      ? { message: LOGIN_MESSAGES.newCodeSent }
      : {}),
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
  // the same code keeps its send time, so the step keeps counting down.
  const codeTiming = {
    channel: state.fields?.channel,
    emailFallbackInSeconds: state.fields?.emailFallbackInSeconds,
    phoneCodeSentAt: state.fields?.phoneCodeSentAt,
  }
  if (scenario === "expired") {
    return {
      fields: { contact },
      errors: { contact: LOGIN_MESSAGES.codeExpired },
    }
  }
  if (scenario === "verify-error") {
    return {
      fields: { contact, otpSent: true, ...codeTiming },
      errors: { form: LOGIN_MESSAGES.checkFailed },
    }
  }
  if (scenario === "sign-in-error") {
    return {
      fields: { contact, otpSent: true, ...codeTiming },
      errors: { form: LOGIN_MESSAGES.signInFailed },
    }
  }
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      fields: { contact, otpSent: true, ...codeTiming },
      errors: { otp: LOGIN_MESSAGES.codeRejected },
    }
  }
  if (scenario === "unknown") return { fields: { contact, noCards: true } }
  return {
    fields: { contact },
    message: "Display verification complete. No session was created.",
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
        form: "Email is slow right now. Try again shortly, or go back to the text code.",
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
      ? "New code sent. Use the latest one."
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
      errors: { email: "Your code expired. Send a new one." },
    }
  }
  if (data.get("otp") !== DISPLAY_OTP) {
    return {
      fields: { ...state.fields, method: "email", otpSent: true },
      errors: { otp: LOGIN_MESSAGES.codeRejected },
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
        ? "You can use your mobile number instead."
        : "Display verification complete. No session was created.",
  }
}
