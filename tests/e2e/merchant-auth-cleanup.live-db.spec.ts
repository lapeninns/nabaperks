import { test } from "@playwright/test"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { runCleanupSteps } from "./helpers/cleanup-lifecycle"
import {
  assertMerchantAuthLiveDbFaultsRestored,
  restoreMerchantAuthLiveDbFaults,
  setMerchantAuthRateLimitReadAvailable,
  setMerchantAuthRateLimitRpcAvailable,
  setMerchantAuthReservationRpcAvailable,
} from "./helpers/merchant-auth-recovery-live-db"

test("Given revoked local auth proof permissions When restoration runs Then every permission and fault object is restored", async () => {
  // Given
  const sql = requiredLocalDb()

  try {
    await setMerchantAuthReservationRpcAvailable(sql, false)
    await setMerchantAuthRateLimitRpcAvailable(sql, false)
    await setMerchantAuthRateLimitReadAvailable(sql, false)

    // When
    await restoreMerchantAuthLiveDbFaults(sql)

    // Then
    await assertMerchantAuthLiveDbFaultsRestored(sql)
  } finally {
    await runCleanupSteps(
      [
        {
          label: "merchant auth fault restoration",
          run: () => restoreMerchantAuthLiveDbFaults(sql),
        },
        {
          label: "local database connection close",
          run: () => sql.end({ timeout: 5 }),
        },
      ],
      "Merchant auth lifecycle proof cleanup failed."
    )
  }
})

function requiredLocalDb(): Sql {
  const sql = connectLocalDb()
  if (!sql) {
    throw new Error("Local Supabase DB is required for auth restoration proof.")
  }
  return sql
}
