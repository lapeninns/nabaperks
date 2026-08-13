import { expect, test } from "@playwright/test"

import { installSeededAdminAal2Session } from "./helpers/admin-mfa-session"
import { connectLocalDb, type Sql } from "./helpers/admin-live-db"

type CountRow = {
  readonly count: number
}

test("Given a real enrolled factor When setup fails after enrolment Then factor readback is zero", async ({
  context,
}) => {
  // Given
  const sql = requiredLocalDb()
  expect(await seededAdminFactorCount(sql)).toBe(0)
  const injectedFailure = new Error("injected post-enrolment failure")

  try {
    // When
    await expect(
      installSeededAdminAal2Session(context, {
        afterEnrollment: async () => {
          throw injectedFailure
        },
      })
    ).rejects.toBe(injectedFailure)

    // Then
    expect(await seededAdminFactorCount(sql)).toBe(0)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

function requiredLocalDb(): Sql {
  const sql = connectLocalDb()
  if (!sql) {
    throw new Error(
      "Local Supabase DB is required for admin MFA cleanup proof."
    )
  }
  return sql
}

async function seededAdminFactorCount(sql: Sql): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from auth.mfa_factors factors
    join auth.users users on users.id = factors.user_id
    where lower(users.email) = 'admin@nabaperks.test'`

  return rows.at(0)?.count ?? 0
}
