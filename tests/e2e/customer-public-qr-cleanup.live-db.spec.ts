import { expect, test } from "@playwright/test"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { runCleanupSteps } from "./helpers/cleanup-lifecycle"
import {
  cleanupCustomerReadbackFixture,
  createCustomerReadbackFixture,
} from "./helpers/customer-readback-live-db"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

test("Given customer and public QR fixtures When cleanup runs Then direct row readback is zero", async () => {
  // Given
  const sql = requiredLocalDb()
  const customerFixture = await createCustomerReadbackFixture(sql)
  const publicQrFixture = await createPublicQrRouterFixture(sql)
  expect(customerFixture).toBeDefined()
  expect(publicQrFixture).toBeDefined()

  // When / Then
  await runCleanupSteps(
    [
      {
        label: "customer fixture cleanup",
        run: () => cleanupCustomerReadbackFixture(sql, customerFixture),
      },
      {
        label: "public QR fixture cleanup",
        run: () => cleanupPublicQrRouterFixture(sql, publicQrFixture),
      },
      {
        label: "local database connection close",
        run: () => sql.end({ timeout: 5 }),
      },
    ],
    "Customer/public QR lifecycle proof cleanup failed."
  )
})

function requiredLocalDb(): Sql {
  const sql = connectLocalDb()
  if (!sql) {
    throw new Error(
      "Local Supabase DB is required for cleanup lifecycle proof."
    )
  }
  return sql
}
