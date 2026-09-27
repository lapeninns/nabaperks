"use server"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"
import {
  editCustomerLoginEmailAction,
  requestCustomerLoginEmailAction,
  switchCustomerLoginMethodAction,
  verifyCustomerLoginEmailAction,
} from "@/app/home/login/email-actions"
import { clearPendingPhoneVerification } from "@/lib/customer/session"

/**
 * Keep the form directly bound to a Server Action before hydration too. One
 * action serves both methods, chosen by `intent`; the email intents live in
 * `email-actions.ts` so the phone actions stay phone-only.
 */
export async function submitCustomerLoginOtpAction(
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  switch (data.get("intent")) {
    case "edit": {
      await clearPendingPhoneVerification()
      const contact = data.get("contact")
      return {
        fields: {
          contact: typeof contact === "string" ? contact : "",
          editingContact: true,
          method: "phone",
        },
      }
    }
    case "verify":
      return onPhone(await verifyCustomerLoginOtpAction(state, data))
    case "email-request":
      return requestCustomerLoginEmailAction(state, data)
    case "email-verify":
      return verifyCustomerLoginEmailAction(state, data)
    case "email-edit":
      return editCustomerLoginEmailAction(state, data)
    case "switch-method":
      return switchCustomerLoginMethodAction(state, data)
    default:
      return onPhone(await requestCustomerLoginOtpAction(state, data))
  }
}

/** A phone answer keeps the screen on the phone form. */
function onPhone(state: CustomerLoginOtpState): CustomerLoginOtpState {
  return { ...state, fields: { ...state.fields, method: "phone" } }
}
