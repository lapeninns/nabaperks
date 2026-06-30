import type { Sql } from "./admin-live-db"

type CountRow = {
  readonly count: number
}

export type InternalAdminAccount = {
  readonly userId: string
  readonly email: string
}

export async function hasInternalAdminRow(
  sql: Sql,
  userId: string
): Promise<boolean> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.internal_admins
    where user_id = ${userId}::uuid`

  return (rows.at(0)?.count ?? 0) > 0
}

export async function insertInactiveInternalAdmin(
  sql: Sql,
  account: InternalAdminAccount
): Promise<void> {
  await sql`
    insert into public.internal_admins (user_id, email, is_active)
    values (${account.userId}::uuid, ${account.email}, false)`
}

export async function deleteInternalAdmin(
  sql: Sql,
  userId: string
): Promise<void> {
  await sql`
    delete from public.internal_admins
    where user_id = ${userId}::uuid`
}
