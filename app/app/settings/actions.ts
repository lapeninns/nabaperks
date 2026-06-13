"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ROI_SAVE_ERROR = "Settings could not be saved. Try again."

export type RoiSettingsState = {
  fields?: {
    averageOrderValue?: string
    estimatedGrossMargin?: string
    rewardCost?: string
  }
  errors?: {
    averageOrderValue?: string
    estimatedGrossMargin?: string
    rewardCost?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseMoney(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null
  return Math.round(Number(input) * 100)
}

function parsePercent(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null
  return Math.round(Number(input) * 100)
}

export async function saveRoiSettingsAction(
  _state: RoiSettingsState,
  formData: FormData
): Promise<RoiSettingsState> {
  const merchant = await getCurrentMerchant()
  const averageOrderValue = value(formData, "averageOrderValue")
  const estimatedGrossMargin = value(formData, "estimatedGrossMargin")
  const rewardCost = value(formData, "rewardCost")
  const fields = { averageOrderValue, estimatedGrossMargin, rewardCost }
  const errors: NonNullable<RoiSettingsState["errors"]> = {}

  if (!merchant) {
    return { fields, errors: { form: "Complete merchant onboarding first." } }
  }

  const averageOrderValuePence = parseMoney(averageOrderValue)
  const estimatedGrossMarginBps = parsePercent(estimatedGrossMargin)
  const rewardCostPence = parseMoney(rewardCost)

  if (averageOrderValuePence === null) {
    errors.averageOrderValue = "Enter a valid average order value."
  }

  if (
    estimatedGrossMarginBps === null ||
    estimatedGrossMarginBps < 0 ||
    estimatedGrossMarginBps > 10000
  ) {
    errors.estimatedGrossMargin = "Enter a gross margin from 0 to 100."
  }

  if (rewardCostPence === null) {
    errors.rewardCost = "Enter a valid reward cost."
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("merchants")
    .update({
      average_order_value_pence: averageOrderValuePence,
      estimated_gross_margin_bps: estimatedGrossMarginBps,
      reward_cost_pence: rewardCostPence,
    })
    .eq("id", merchant.id)

  if (error) {
    return {
      fields,
      errors: { form: ROI_SAVE_ERROR },
    }
  }

  revalidatePath("/app")
  revalidatePath("/app/settings")

  return { fields, message: "Settings saved." }
}
