import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

export type StaffMember = {
  id: string
  displayName: string
  role: string
  isActive: boolean
  createdAt: string
}

export type AddStaffMemberResult =
  | { status: "created"; staffId: string }
  | { status: "invalid"; reason: string }

export async function listStaffMembers(): Promise<StaffMember[]> {
  const merchant = await getCurrentMerchant()

  if (!merchant) return []

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, display_name, role, is_active, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Unable to load staff members: ${error.message}`)
  }

  type Row = {
    id: string
    display_name: string
    role: string
    is_active: boolean
    created_at: string
  }

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  }))
}

export async function addStaffMember(
  displayName: string,
  pin: string
): Promise<AddStaffMemberResult> {
  const trimmedName = displayName.trim()

  if (!trimmedName) {
    return { status: "invalid", reason: "Give the staff member a name." }
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { status: "invalid", reason: "PIN must be 4 to 6 digits." }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("add_staff_member", {
    p_display_name: trimmedName,
    p_pin: pin,
  })

  if (error) {
    if (/pin must be/i.test(error.message)) {
      return { status: "invalid", reason: "PIN must be 4 to 6 digits." }
    }

    if (/display name is required/i.test(error.message)) {
      return { status: "invalid", reason: "Give the staff member a name." }
    }

    throw new Error(`Unable to add the staff member: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    throw new Error("Unable to add the staff member")
  }

  return { status: "created", staffId: row.staff_id }
}

export async function setStaffMemberActive(
  staffId: string,
  active: boolean
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("set_staff_member_active", {
    p_staff_id: staffId,
    p_active: active,
  })

  if (error) {
    throw new Error(`Unable to update the staff member: ${error.message}`)
  }
}
