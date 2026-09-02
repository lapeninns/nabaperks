import "server-only"

import { isStrongCustomerSessionSecret } from "@/lib/security/customer-session-secret-core"

export function requiredCustomerSessionSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret || !isStrongCustomerSessionSecret(secret)) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET must use a generated high-entropy value of at least 32 characters."
    )
  }
  return secret
}
