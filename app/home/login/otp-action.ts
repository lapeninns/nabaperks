"use server"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"

/** Keep the form directly bound to a Server Action before hydration too. */
export async function submitCustomerLoginOtpAction(
  state: CustomerLoginOtpState,
  data: FormData
): Promise<CustomerLoginOtpState> {
  return data.get("intent") === "verify"
    ? verifyCustomerLoginOtpAction(state, data)
    : requestCustomerLoginOtpAction(state, data)
}
