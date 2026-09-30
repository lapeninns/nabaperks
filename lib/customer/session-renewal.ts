import { createClient } from "@supabase/supabase-js"

import type { CustomerSessionActivityCheck } from "@/lib/customer/session-renewal-core"
import { logger } from "@/lib/observability/logger"
import {
  CUSTOMER_DEVICE_HEADER,
  customerDeviceHashFromHeaders,
} from "@/lib/security/rate-limit-core"

/**
 * The proxy's database check before it extends a session cookie: the same
 * device-bound `touch_customer_session` every session read relies on, which
 * is false for a revoked, expired or deleted session or another device.
 *
 * Kept free of `server-only` and request APIs so Proxy can import it. It is
 * called only for a renewal that is already due, never on every request.
 *
 * `false` clears the browser's cookie, so it is returned only for the
 * database's own answer. Missing configuration or a failed call throws, which
 * leaves the cookie untouched.
 */
export function customerSessionActivityCheck(
  deviceId: string
): CustomerSessionActivityCheck {
  return async ({ customerId, sessionId }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    const deviceHash = customerDeviceHashFromHeaders(
      new Headers({ [CUSTOMER_DEVICE_HEADER]: deviceId })
    )
    if (!url || !serviceRoleKey || !deviceHash) {
      throw new Error("Customer session renewal check is not configured.")
    }

    const supabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase.rpc("touch_customer_session", {
      p_customer_id: customerId,
      p_session_id: sessionId,
      p_device_hash: deviceHash,
    })
    if (error) {
      logger.warn("customer_session_renewal_check_failed", {
        code: error.code ?? null,
      })
      throw new Error("Unable to confirm the customer session for renewal.")
    }
    return data === true
  }
}
