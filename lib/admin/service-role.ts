import "server-only"

import { requireAdminStepUp } from "@/lib/admin/auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The only admin path to a service-role client. That client bypasses RLS
 * outright, so the database-side assurance gate in `is_internal_admin()` cannot
 * see it — this factory is where the step-up requirement has to be enforced for
 * admin reads, not in the /admin layout.
 */
export async function createAdminServiceRoleClient() {
  await requireAdminStepUp()
  return createSupabaseServiceRoleClient()
}
