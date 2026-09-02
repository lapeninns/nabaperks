"use server"

import { redirect } from "next/navigation"

import { clearCustomerSession } from "@/lib/customer/session"
import {
  customerLoginHref,
  safeNextPath,
} from "@/lib/navigation/safe-next-path"

export async function resetCustomerSessionAction(
  formData: FormData
): Promise<never> {
  const rawNext = formData.get("next")
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : "/home")

  await clearCustomerSession()
  redirect(customerLoginHref(next))
}
