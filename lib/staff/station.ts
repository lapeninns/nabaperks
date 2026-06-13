import "server-only"

import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const STATION_COOKIE = "nb_station"

export type StationCredentials = {
  stationId: string
  stationSecret: string
}

export function parseStationCookie(
  value: string | undefined
): StationCredentials | null {
  if (!value) return null

  const separator = value.indexOf(".")

  if (separator <= 0 || separator === value.length - 1) return null

  return {
    stationId: value.slice(0, separator),
    stationSecret: value.slice(separator + 1),
  }
}

export function serializeStationCookie(credentials: StationCredentials) {
  return `${credentials.stationId}.${credentials.stationSecret}`
}

export type PairStationResult =
  | {
      status: "paired"
      credentials: StationCredentials
      stationName: string
      merchantName: string
    }
  | { status: "invalid" }

export type StationState =
  | { status: "unpaired" }
  | {
      status: "ready"
      stationName: string
      merchantName: string
      session: { id: string; staffName: string; startedAt: string } | null
      staffMembers: Array<{ id: string; displayName: string }>
      stampsToday: number
      redemptionsToday: number
      lastAction: { summary: string; at: string } | null
      lockedUntil: string | null
    }

export type StartSessionResult =
  | { status: "started"; sessionId: string; staffName: string }
  | { status: "rejected" }
  | { status: "locked" }

export type CodeLookup =
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "already_used"; kind: "stamp" | "redeem"; usedAt: string }
  | {
      status: "ready"
      kind: "stamp" | "redeem"
      tokenId: string
      customerLabel: string
      stampCount: number
      stampsRequired: number
      duplicateWarning: string | null
      reward: {
        name: string
        terms: string
        minSpendPence: number | null
        redeemableFrom: string | null
      } | null
    }

export type ApproveStampResult =
  | {
      status: "approved"
      stampEventId: string
      newStampCount: number
      rewardUnlocked: boolean
      replayed: boolean
    }
  | { status: "already_used" }
  | { status: "expired" }
  | { status: "blocked"; reason: string }

export type RedeemResult =
  | {
      status: "redeemed"
      rewardId: string
      rewardName: string
      membershipId: string
      newStampCount: number
      replayed: boolean
    }
  | { status: "already_redeemed"; redeemedAt: string | null }
  | { status: "expired" }
  | { status: "blocked"; reason: string }

export type UndoResult =
  | { status: "undone"; newStampCount: number }
  | { status: "window_closed" }
  | { status: "blocked"; reason: string }

type StationStateRow = {
  station_name: string
  merchant_name: string
  session_id: string | null
  session_staff_name: string | null
  session_started_at: string | null
  staff_members: Array<{ id: string; display_name: string }> | null
  stamps_today: number | null
  redemptions_today: number | null
  last_action_summary: string | null
  last_action_at: string | null
  locked_until: string | null
}

export async function pairStation(
  pairingCode: string
): Promise<PairStationResult> {
  try {
    await enforceRateLimit({
      key: `station-pair:${pairingCode.trim().toUpperCase()}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return { status: "invalid" }

    throw error
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("pair_station", {
    p_pairing_code: pairingCode.trim().toUpperCase(),
  })

  if (error) {
    if (/pairing code was not accepted/i.test(error.message)) {
      return { status: "invalid" }
    }

    throw new Error(`Unable to pair the station: ${error.message}`)
  }

  const row = first<{
    station_id: string
    station_secret: string
    station_name: string
    merchant_name: string
  }>(data)

  if (!row) return { status: "invalid" }

  return {
    status: "paired",
    credentials: {
      stationId: row.station_id,
      stationSecret: row.station_secret,
    },
    stationName: row.station_name,
    merchantName: row.merchant_name,
  }
}

export async function getStationState(
  credentials: StationCredentials
): Promise<StationState> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_station_state", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
  })

  if (error) {
    if (/station credential was not accepted/i.test(error.message)) {
      return { status: "unpaired" }
    }

    throw new Error(`Unable to load the station: ${error.message}`)
  }

  const row = first<StationStateRow>(data)

  if (!row) return { status: "unpaired" }

  return {
    status: "ready",
    stationName: row.station_name,
    merchantName: row.merchant_name,
    session: row.session_id
      ? {
          id: row.session_id,
          staffName: row.session_staff_name ?? "Staff",
          startedAt: row.session_started_at ?? "",
        }
      : null,
    staffMembers: (row.staff_members ?? []).map((member) => ({
      id: member.id,
      displayName: member.display_name,
    })),
    stampsToday: row.stamps_today ?? 0,
    redemptionsToday: row.redemptions_today ?? 0,
    lastAction:
      row.last_action_summary && row.last_action_at
        ? { summary: row.last_action_summary, at: row.last_action_at }
        : null,
    lockedUntil: row.locked_until,
  }
}

export async function startStaffSession(
  credentials: StationCredentials,
  staffUserId: string,
  pin: string
): Promise<StartSessionResult> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("start_staff_session", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_staff_user_id: staffUserId,
    p_pin: pin,
  })

  if (error) {
    if (/pin pad locked/i.test(error.message)) {
      return { status: "locked" }
    }

    if (
      /staff pin was not accepted|station credential was not accepted/i.test(
        error.message
      )
    ) {
      return { status: "rejected" }
    }

    throw new Error(`Unable to start the staff session: ${error.message}`)
  }

  const row = first<{ session_id: string; staff_display_name: string }>(data)

  if (!row) return { status: "rejected" }

  return {
    status: "started",
    sessionId: row.session_id,
    staffName: row.staff_display_name,
  }
}

export async function endStaffSession(
  credentials: StationCredentials,
  sessionId: string
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("end_staff_session", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_session_id: sessionId,
  })

  if (error && !/station credential was not accepted/i.test(error.message)) {
    throw new Error(`Unable to end the staff session: ${error.message}`)
  }
}

export async function lookupCode(
  credentials: StationCredentials,
  code: string
): Promise<CodeLookup> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("lookup_verification_code", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_code: code.trim().toUpperCase(),
  })

  if (error) {
    throw new Error(`Unable to look up the code: ${error.message}`)
  }

  const row = first<{
    status: "not_found" | "expired" | "already_used" | "ready"
    kind: "stamp" | "redeem"
    token_id: string
    customer_label: string | null
    stamp_count: number | null
    stamps_required: number | null
    duplicate_warning: string | null
    consumed_at: string | null
    reward_name: string | null
    reward_terms: string | null
    min_spend_pence: number | null
    redeemable_from: string | null
  }>(data)

  if (!row || row.status === "not_found") return { status: "not_found" }

  if (row.status === "expired") return { status: "expired" }

  if (row.status === "already_used") {
    return {
      status: "already_used",
      kind: row.kind,
      usedAt: row.consumed_at ?? "",
    }
  }

  return {
    status: "ready",
    kind: row.kind,
    tokenId: row.token_id,
    customerLabel: row.customer_label ?? "Card",
    stampCount: row.stamp_count ?? 0,
    stampsRequired: row.stamps_required ?? 0,
    duplicateWarning: row.duplicate_warning,
    reward:
      row.kind === "redeem" && row.reward_name
        ? {
            name: row.reward_name,
            terms: row.reward_terms ?? "",
            minSpendPence: row.min_spend_pence,
            redeemableFrom: row.redeemable_from,
          }
        : null,
  }
}

export async function approveStamp(
  credentials: StationCredentials,
  sessionId: string,
  tokenId: string
): Promise<ApproveStampResult> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("approve_stamp_token", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_session_id: sessionId,
    p_token_id: tokenId,
  })

  if (error) {
    if (/code already used/i.test(error.message)) {
      return { status: "already_used" }
    }

    if (/code expired/i.test(error.message)) {
      return { status: "expired" }
    }

    const reason = approvalBlockedReason(error.message)

    if (reason) return { status: "blocked", reason }

    throw new Error(`Unable to approve the stamp: ${error.message}`)
  }

  const row = first<{
    stamp_event_id: string
    new_stamp_count: number
    reward_unlocked: boolean
    replayed: boolean
  }>(data)

  if (!row) {
    throw new Error("Unable to approve the stamp")
  }

  return {
    status: "approved",
    stampEventId: row.stamp_event_id,
    newStampCount: row.new_stamp_count,
    rewardUnlocked: Boolean(row.reward_unlocked),
    replayed: Boolean(row.replayed),
  }
}

export async function redeemRewardToken(
  credentials: StationCredentials,
  sessionId: string,
  tokenId: string
): Promise<RedeemResult> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("redeem_reward_token", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_session_id: sessionId,
    p_token_id: tokenId,
  })

  if (error) {
    if (/already redeemed/i.test(error.message)) {
      const timestamp = error.message.match(
        /already redeemed at (.+)$/i
      )?.[1]

      return { status: "already_redeemed", redeemedAt: timestamp ?? null }
    }

    if (/code expired/i.test(error.message)) {
      return { status: "expired" }
    }

    const reason = approvalBlockedReason(error.message)

    if (reason) return { status: "blocked", reason }

    throw new Error(`Unable to redeem the reward: ${error.message}`)
  }

  const row = first<{
    reward_event_id: string
    reward_name: string
    membership_id: string
    new_stamp_count: number
    replayed: boolean
  }>(data)

  if (!row) {
    throw new Error("Unable to redeem the reward")
  }

  return {
    status: "redeemed",
    rewardId: row.reward_event_id,
    rewardName: row.reward_name,
    membershipId: row.membership_id,
    newStampCount: row.new_stamp_count,
    replayed: Boolean(row.replayed),
  }
}

export async function undoStamp(
  credentials: StationCredentials,
  sessionId: string,
  stampEventId: string
): Promise<UndoResult> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("undo_recent_stamp", {
    p_station_id: credentials.stationId,
    p_station_secret: credentials.stationSecret,
    p_session_id: sessionId,
    p_stamp_event_id: stampEventId,
  })

  if (error) {
    if (/undo window has closed/i.test(error.message)) {
      return { status: "window_closed" }
    }

    if (/stamp already undone/i.test(error.message)) {
      return { status: "blocked", reason: "This stamp has already been undone." }
    }

    if (/reward already redeemed/i.test(error.message)) {
      return {
        status: "blocked",
        reason: "The reward from this stamp has already been redeemed.",
      }
    }

    if (/only available from the station/i.test(error.message)) {
      return {
        status: "blocked",
        reason: "Undo is only available from the station that stamped.",
      }
    }

    throw new Error(`Unable to undo the stamp: ${error.message}`)
  }

  const row = first<{ new_stamp_count: number }>(data)

  if (!row) {
    throw new Error("Unable to undo the stamp")
  }

  return { status: "undone", newStampCount: row.new_stamp_count }
}

function approvalBlockedReason(message: string) {
  if (message.includes("Stamp already issued for this UK business day")) {
    return "Already stamped today — one stamp per UK business day."
  }

  if (message.includes("A reward is already ready to redeem")) {
    return "Their reward is ready. Redeem it before stamping again."
  }

  if (message.includes("reward pool item")) {
    return "Add a reward to the pool before the final stamp can land."
  }

  if (message.includes("Active staff session required")) {
    return "Start a staff session before approving."
  }

  if (message.includes("Reward is not redeemable until the next UK business day")) {
    return "Give it a day to breathe — redeemable from the next UK business day."
  }

  if (message.includes("Reward is not ready") || message.includes("not redeemable")) {
    return "This reward is not redeemable."
  }

  if (message.includes("not active") || message.includes("unavailable")) {
    return "This loyalty programme is unavailable right now."
  }

  if (message.includes("Code was not accepted")) {
    return "That code was not recognised. Ask for a fresh one."
  }

  return null
}

function first<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null

  return (data as T) ?? null
}
