"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type StaffStampState = {
  fields?: {
    membershipId?: string
  }
  errors?: {
    pin?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function stampErrorMessage(message: string) {
  if (
    message.includes("Too many failed PIN attempts") ||
    message.includes("Too many incorrect PIN attempts")
  ) {
    return "Too many failed PIN attempts. Wait before trying again."
  }

  if (
    message.includes("Invalid staff PIN") ||
    message.includes("Staff PIN was not accepted")
  ) {
    return "That staff PIN was not accepted."
  }

  if (message.includes("business day")) {
    return "A stamp has already been issued for this UK business day."
  }

  if (
    message.includes("Stamp already issued recently") ||
    message.includes("wait before claiming another stamp")
  ) {
    return "A stamp was already issued recently."
  }

  if (
    message.includes("Reward already ready") ||
    message.includes("reward is already ready")
  ) {
    return "This card already has enough stamps for a reward."
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "This loyalty card is not available for stamps right now."
  }

  return "The stamp could not be issued."
}

export async function issueStaffStampAction(
  _state: StaffStampState,
  formData: FormData
): Promise<StaffStampState> {
  const membershipId = value(formData, "membershipId")
  const pin = value(formData, "pin")

  if (!membershipId) {
    return { errors: { form: "Open the stamp claim from the customer card." } }
  }

  if (!/^\d{4,12}$/.test(pin)) {
    return {
      fields: { membershipId },
      errors: { pin: "Enter the staff PIN." },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("issue_stamp_with_staff_pin", {
    p_membership_id: membershipId,
    p_pin: pin,
  })

  if (error) {
    return {
      fields: { membershipId },
      errors: { form: stampErrorMessage(error.message) },
    }
  }

  await capturePostHogEvent({
    eventName: "stamp_issued",
    membershipId,
    actorType: "staff",
    metadata: { approved_by: "staff_pin" },
  })

  if (data?.[0]?.reward_unlocked) {
    await capturePostHogEvent({
      eventName: "reward_unlocked",
      membershipId,
      actorType: "system",
      metadata: { trigger: "stamp_issued" },
    })
  }

  redirect(`/card/${membershipId}?stamp=issued`)
}
