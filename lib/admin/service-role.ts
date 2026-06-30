import "server-only"

import { requireAdminRead } from "@/lib/admin/auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function createAdminServiceRoleClient() {
  await requireAdminRead()
  return createSupabaseServiceRoleClient()
}
