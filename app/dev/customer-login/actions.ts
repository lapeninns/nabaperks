"use server"

import { notFound } from "next/navigation"

import type { CustomerLoginOtpState } from "@/app/home/actions"

export async function submitLoginFixture(
  scenario: string,
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  if (data.get("intent") === "edit") {
    return {
      fields: {
        contact: String(data.get("contact") ?? ""),
        editingContact: true,
      },
    }
  }
  return data.get("intent") === "verify"
    ? verifyLoginFixture(scenario, state, data)
    : requestLoginFixture(scenario, state, data)
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
      fields: { contact },
      errors: { form: "We couldn't send a code just now. Try again shortly." },
    }
  }
  return {
    fields: { contact, otpSent: true },
    message:
      "If a code arrives for that number, enter it here. Otherwise scan a venue QR to join first.",
  }
}

async function verifyLoginFixture(
  scenario: string,
  _state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (process.env.NODE_ENV === "production") notFound()
  const contact = String(data.get("contact") ?? "")
  if (scenario === "expired")
    return { errors: { contact: "Request a new phone code." } }
  if (scenario === "verify-error") {
    return {
      fields: { contact, otpSent: true },
      errors: {
        form: "We couldn't check that code. Try again or request a new one.",
      },
    }
  }
  if (data.get("otp") !== "424242") {
    return {
      fields: { contact, otpSent: true },
      errors: { otp: "That code was not accepted." },
    }
  }
  return {
    fields: { contact },
    message:
      scenario === "unknown"
        ? "No cards found for that number yet. Scan a venue QR to join first."
        : "Display verification complete. No session was created.",
  }
}
