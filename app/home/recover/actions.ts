"use server"

import { redirect } from "next/navigation"

import {
  resendCustomerAccessRecovery,
  verifyCustomerAccessRecovery,
} from "@/lib/customer/access-continuity"
import {
  clearPendingAccessRecovery,
  setCustomerSession,
} from "@/lib/customer/session"
import { RateLimitError } from "@/lib/security/rate-limit"

const EXPIRED = "This code has expired. Start again with your mobile number."

export type CustomerAccessRecoveryState = {
  errors?: {
    code?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function verifyCustomerAccessRecoveryAction(
  state: CustomerAccessRecoveryState,
  formData: FormData
): Promise<CustomerAccessRecoveryState> {
  void state
  const code = value(formData, "code")
  if (!/^\d{6}$/.test(code)) {
    return { errors: { code: "Enter the 6-digit code from your email." } }
  }

  let result: Awaited<ReturnType<typeof verifyCustomerAccessRecovery>>
  try {
    result = await verifyCustomerAccessRecovery(code)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        errors: {
          form: "Too many tries. Send a new code in a few minutes.",
        },
      }
    }
    throw error
  }

  if (result.status === "rejected") {
    return {
      errors: { code: "That code didn't work. Check it and try again." },
    }
  }
  if (result.status === "unavailable") {
    return {
      errors: { form: EXPIRED },
    }
  }

  await setCustomerSession(
    result.customerId,
    "verified_email",
    result.sessionId
  )
  await clearPendingAccessRecovery()
  redirect(result.next)
}

export async function resendCustomerAccessRecoveryAction(
  state: CustomerAccessRecoveryState
): Promise<CustomerAccessRecoveryState> {
  void state
  try {
    const sent = await resendCustomerAccessRecovery()
    return sent
      ? { message: "New code sent. Use the latest one." }
      : { errors: { form: EXPIRED } }
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        errors: {
          form: "Too many codes requested. Try again in a few minutes.",
        },
      }
    }
    return {
      errors: { form: "We couldn't send a new code just now. Try again." },
    }
  }
}
