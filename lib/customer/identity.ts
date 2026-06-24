import "server-only"

import { cache } from "react"

import {
  customerPhoneHmac,
  customerPhonePii,
  maskedPhoneFromLast4,
} from "@/lib/customer/phone-pii"
import type { NormalizedPhone } from "@/lib/customer/phone"
import { getCustomerSession } from "@/lib/customer/session"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CurrentCustomer = {
  id: string
  authUserId: string | null
  email: string | null
  emailVerifiedAt: string | null
  fullName: string | null
  dateOfBirth: string | null
  phone: string | null
  phoneLast4: string | null
  phoneCountry: string | null
  createdAt: string
}

const CUSTOMER_COLUMNS =
  "id, auth_user_id, email, email_verified_at, full_name, date_of_birth, phone, phone_last4, phone_country, created_at"

export const getCurrentCustomer = cache(
  async (): Promise<CurrentCustomer | null> => {
    const session = await getCustomerSession()

    if (!session) return null

    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .eq("id", session.customerId)
      .maybeSingle()

    if (error) {
      throw new Error(`Unable to load customer: ${error.message}`)
    }

    if (!data) return null

    return toCurrentCustomer(data)
  }
)

export async function findCustomerByVerifiedPhone(
  phone: NormalizedPhone
): Promise<CurrentCustomer | null> {
  const supabase = createSupabaseServiceRoleClient()
  const phoneHmac = customerPhoneHmac(phone.e164)
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("phone_hmac", phoneHmac)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load customer: ${error.message}`)
  }

  return data ? toCurrentCustomer(data) : null
}

export async function getOrCreateCustomerByVerifiedPhone(
  phone: NormalizedPhone
): Promise<CurrentCustomer> {
  const existing = await findCustomerByVerifiedPhone(phone)
  if (existing) return existing

  const supabase = createSupabaseServiceRoleClient()
  const pii = customerPhonePii(phone.e164)
  const { data, error } = await supabase
    .from("customers")
    .insert({
      auth_user_id: null,
      email: null,
      phone: null,
      phone_hmac: pii.phoneHmac,
      phone_ciphertext: pii.phoneCiphertext,
      phone_last4: pii.phoneLast4,
      phone_country: phone.country,
      phone_verified_at: new Date().toISOString(),
    })
    .select(CUSTOMER_COLUMNS)
    .single()

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const raced = await findCustomerByVerifiedPhone(phone)
      if (raced) return raced
    }

    throw new Error(`Unable to create customer: ${error.message}`)
  }

  const customer = toCurrentCustomer(data)
  if (!customer) {
    throw new Error("Unable to create customer.")
  }

  return customer
}

export function firstOf<T>(value: T | T[] | null): T | null {
  if (value === null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toCurrentCustomer(row: unknown): CurrentCustomer | null {
  if (!isRecord(row)) return null

  const id = stringValue(row.id)
  const createdAt = stringValue(row.created_at)
  if (!id || !createdAt) return null

  const phone = nullableString(row.phone)
  const phoneLast4 = nullableString(row.phone_last4)

  return {
    id,
    authUserId: nullableString(row.auth_user_id),
    email: nullableString(row.email),
    emailVerifiedAt: nullableString(row.email_verified_at),
    fullName: nullableString(row.full_name),
    dateOfBirth: nullableString(row.date_of_birth),
    phone: phone ?? maskedPhoneFromLast4(phoneLast4),
    phoneLast4,
    phoneCountry: nullableString(row.phone_country),
    createdAt,
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
