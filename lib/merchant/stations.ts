import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

export type StationSummary = {
  id: string
  stationName: string
  status: "unpaired" | "active" | "revoked"
  pairingCode: string | null
  pairingExpiresAt: string | null
  pairedAt: string | null
  lastSeenAt: string | null
}

export type CreatePairingResult =
  | {
      status: "created"
      stationId: string
      stationName: string
      pairingCode: string
      pairingExpiresAt: string
    }
  | { status: "invalid"; reason: string }

export async function listStations(): Promise<StationSummary[]> {
  const merchant = await getCurrentMerchant()

  if (!merchant) return []

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("stations")
    .select(
      "id, station_name, status, pairing_code, pairing_expires_at, paired_at, last_seen_at"
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Unable to load stations: ${error.message}`)
  }

  type Row = {
    id: string
    station_name: string
    status: StationSummary["status"]
    pairing_code: string | null
    pairing_expires_at: string | null
    paired_at: string | null
    last_seen_at: string | null
  }

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    stationName: row.station_name,
    status: row.status,
    pairingCode: row.pairing_code,
    pairingExpiresAt: row.pairing_expires_at,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
  }))
}

export async function createStationPairing(
  stationName: string
): Promise<CreatePairingResult> {
  const trimmed = stationName.trim()

  if (!trimmed) {
    return { status: "invalid", reason: "Give the station a name." }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("create_station_pairing", {
    p_station_name: trimmed,
  })

  if (error) {
    if (/station name is required/i.test(error.message)) {
      return { status: "invalid", reason: "Give the station a name." }
    }

    throw new Error(`Unable to create the station: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    throw new Error("Unable to create the station")
  }

  return {
    status: "created",
    stationId: row.station_id,
    stationName: row.station_name,
    pairingCode: row.pairing_code,
    pairingExpiresAt: row.pairing_expires_at,
  }
}

export async function revokeStation(stationId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("revoke_station", {
    p_station_id: stationId,
  })

  if (error) {
    throw new Error(`Unable to revoke the station: ${error.message}`)
  }
}
