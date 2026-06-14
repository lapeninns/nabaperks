import postgres from "postgres"

import {
  readCustomerFlowDemoEnv,
  requiredCustomerFlowEnv,
  resolveCustomerFlowDbUrl,
  shouldRequireCustomerFlowSsl,
} from "./customer-flow-env.ts"
import { runCustomerFlowSqlCommand } from "./customer-flow-demo-sql.ts"
import {
  CUSTOMER_FLOW_DEMO,
  demoPhoneHmac,
  normalizeDemoPhone,
  type AdvanceResult,
  type CustomerFlowCommandInput,
  type CustomerFlowCommandResult,
  type CustomerFlowStatus,
  type MakeRedeemableResult,
  type ResetResult,
} from "./customer-flow-demo-types.ts"
import { CustomerFlowDemoError } from "./customer-flow-demo-error.ts"

export async function getCustomerFlowStatus(
  phone = CUSTOMER_FLOW_DEMO.phone
): Promise<CustomerFlowStatus> {
  return runCustomerFlowCommand({ command: "status", phone })
}

export async function resetCustomerFlowDemo(
  phone = CUSTOMER_FLOW_DEMO.phone
): Promise<ResetResult> {
  return runCustomerFlowCommand({ command: "reset", phone })
}

export async function advanceCustomerFlowDemo(
  stamps: 0 | 1 | 2,
  phone = CUSTOMER_FLOW_DEMO.phone
): Promise<AdvanceResult> {
  return runCustomerFlowCommand({ command: "advance", phone, stamps })
}

export async function makeCustomerFlowRewardRedeemable(
  phone = CUSTOMER_FLOW_DEMO.phone
): Promise<MakeRedeemableResult> {
  return runCustomerFlowCommand({ command: "make-redeemable", phone })
}

export function runCustomerFlowCommand(input: {
  readonly command: "status"
  readonly phone: string
}): Promise<CustomerFlowStatus>
export function runCustomerFlowCommand(input: {
  readonly command: "reset"
  readonly phone: string
}): Promise<ResetResult>
export function runCustomerFlowCommand(input: {
  readonly command: "advance"
  readonly phone: string
  readonly stamps: number
}): Promise<AdvanceResult>
export function runCustomerFlowCommand(input: {
  readonly command: "make-redeemable"
  readonly phone: string
}): Promise<MakeRedeemableResult>
export function runCustomerFlowCommand(
  input: CustomerFlowCommandInput
): Promise<CustomerFlowCommandResult>
export async function runCustomerFlowCommand(
  input: CustomerFlowCommandInput
): Promise<CustomerFlowCommandResult> {
  const env = readCustomerFlowDemoEnv()
  const dbUrl = resolveCustomerFlowDbUrl(env)

  if (!dbUrl) {
    throw new CustomerFlowDemoError(
      "SUPABASE_DB_URL or SUPABASE_DB_PASSWORD with supabase/.temp/pooler-url is required."
    )
  }

  const phone = normalizeDemoPhone(input.phone)
  const phoneHmac = demoPhoneHmac(
    phone,
    requiredCustomerFlowEnv(env, "CUSTOMER_PHONE_HMAC_SECRET")
  )
  const sql = postgres(dbUrl, {
    max: 1,
    ssl: shouldRequireCustomerFlowSsl(dbUrl) ? "require" : undefined,
  })

  try {
    return await runCustomerFlowSqlCommand(sql, { ...input, phone }, phoneHmac)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
