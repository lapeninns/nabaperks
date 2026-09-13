"use server"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"
import { clearPendingPhoneVerification } from "@/lib/customer/session"

/** Keep the form directly bound to a Server Action before hydration too. */
export async function submitCustomerLoginOtpAction(
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  if (data.get("intent") === "edit") {
    await clearPendingPhoneVerification()
    const contact = data.get("contact")
    return {
      fields: {
        contact: typeof contact === "string" ? contact : "",
        editingContact: true,
      },
    }
  }
  return data.get("intent") === "verify"
    ? verifyCustomerLoginOtpAction(state, data)
    : requestCustomerLoginOtpAction(state, data)
}
