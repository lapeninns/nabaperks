import { createHmac } from "node:crypto"

import { CustomerFlowDemoError } from "./customer-flow-demo-error.ts"

export const CUSTOMER_FLOW_DEMO = {
  phone: "07467586751",
  merchantId: "10000000-0000-0000-0000-000000000001",
  merchantSlug: "old-crown-girton",
  qrId: "old-crown-girton-qr",
} as const

export const CUSTOMER_FLOW_COMMANDS = [
  "reset",
  "status",
  "advance",
  "remove-stamp",
  "make-redeemable",
] as const

export type CustomerFlowCommand = (typeof CUSTOMER_FLOW_COMMANDS)[number]

export type CustomerFlowRewardStatus = {
  readonly id: string
  readonly status: string
  readonly rewardName: string
  readonly redeemableFrom: string | null
}

export type CustomerFlowStatus = {
  readonly phone: string
  readonly merchantSlug: string
  readonly qrId: string
  readonly customerId: string | null
  readonly membershipId: string | null
  readonly currentStampCount: number
  readonly totalStampsEarned: number
  readonly latestBusinessDate: string | null
  readonly latestReward: CustomerFlowRewardStatus | null
}

export type CustomerFlowJourneyLinks = {
  readonly joinHero: string
  readonly join: string
  readonly qrStampConfirm: string | null
  readonly stampConfirm: string | null
  readonly card: string | null
  readonly reward: string | null
  readonly redeemedCard: string | null
}

export type CustomerFlowStatusRow = {
  readonly customer_id: string | null
  readonly membership_id: string | null
  readonly current_stamp_count: number | null
  readonly total_stamps_earned: number | null
  readonly latest_business_date: string | null
}

export type CustomerFlowRewardRow = {
  readonly id: string
  readonly status: string
  readonly reward_name: string
  readonly redeemable_from: string | null
}

export type RemoveStampResult = {
  readonly phone: string
  readonly membershipId: string
  readonly currentStampCount: number
  readonly cancelledRewards: number
  readonly message: string
}

export type CustomerFlowCommandInput =
  | {
      readonly command: "reset" | "status" | "make-redeemable" | "remove-stamp"
      readonly phone: string
    }
  | {
      readonly command: "advance"
      readonly phone: string
      readonly stamps: number
    }

export type StampEventRow = {
  readonly id: string
}

export type ResetResult = {
  readonly phone: string
  readonly customerId: string | null
  readonly merchantSlug: string
  readonly qrId: string
  readonly message: string
}

export type AdvanceResult = {
  readonly phone: string
  readonly membershipId: string
  readonly stamps: number
  readonly message: string
}

export type MakeRedeemableResult = {
  readonly phone: string
  readonly membershipId: string | null
  readonly rewardId: string
  readonly message: string
}

export type CustomerFlowCommandResult =
  | CustomerFlowStatus
  | ResetResult
  | AdvanceResult
  | RemoveStampResult
  | MakeRedeemableResult

export function normalizeDemoPhone(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, "")

  if (trimmed.startsWith("+") && /^\d{8,15}$/.test(digits)) return `+${digits}`
  if (digits.startsWith("44") && digits.length >= 11) return `+${digits}`
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+44${digits.slice(1)}`
  }

  throw new CustomerFlowDemoError(
    "Use a valid UK phone number for the customer flow."
  )
}

export function demoPhoneHmac(e164: string, secret: string): string {
  return createHmac("sha256", secret).update(e164).digest("hex")
}

export function customerFlowStatusFromRow({
  phone,
  row,
  latestReward,
}: {
  readonly phone: string
  readonly row: CustomerFlowStatusRow | null
  readonly latestReward: CustomerFlowRewardRow | null
}): CustomerFlowStatus {
  return {
    phone,
    merchantSlug: CUSTOMER_FLOW_DEMO.merchantSlug,
    qrId: CUSTOMER_FLOW_DEMO.qrId,
    customerId: row?.customer_id ?? null,
    membershipId: row?.membership_id ?? null,
    currentStampCount: row?.current_stamp_count ?? 0,
    totalStampsEarned: row?.total_stamps_earned ?? 0,
    latestBusinessDate: row?.latest_business_date ?? null,
    latestReward: latestReward
      ? {
          id: latestReward.id,
          status: latestReward.status,
          rewardName: latestReward.reward_name,
          redeemableFrom: latestReward.redeemable_from,
        }
      : null,
  }
}

export function buildCustomerFlowJourneyLinks(
  status: CustomerFlowStatus
): CustomerFlowJourneyLinks {
  const membershipId = status.membershipId
  const rewardId = status.latestReward?.id ?? null

  return {
    joinHero: `/q/${CUSTOMER_FLOW_DEMO.qrId}`,
    join: `/m/${CUSTOMER_FLOW_DEMO.merchantSlug}/join?qr=${CUSTOMER_FLOW_DEMO.qrId}`,
    qrStampConfirm: membershipId ? `/q/${CUSTOMER_FLOW_DEMO.qrId}` : null,
    stampConfirm: membershipId
      ? `/card/${membershipId}/stamp?qr=${CUSTOMER_FLOW_DEMO.qrId}`
      : null,
    card: membershipId ? `/card/${membershipId}` : null,
    reward: rewardId ? `/reward/${rewardId}` : null,
    redeemedCard: membershipId ? `/card/${membershipId}?reward=redeemed` : null,
  }
}

export function assertAdvancePreconditions(
  status: CustomerFlowStatus,
  earnedStampCount: number,
  requestedStamps: number
): asserts status is CustomerFlowStatus & { readonly membershipId: string } {
  if (!status.membershipId) {
    throw new CustomerFlowDemoError(
      "Customer membership does not exist. Run the join phase first."
    )
  }

  if (earnedStampCount !== requestedStamps) {
    throw new CustomerFlowDemoError(
      `Expected exactly ${requestedStamps} earned stamp rows; found ${earnedStampCount}.`
    )
  }
}

export function isCustomerFlowCommand(
  value: string
): value is CustomerFlowCommand {
  return CUSTOMER_FLOW_COMMANDS.some((command) => command === value)
}
