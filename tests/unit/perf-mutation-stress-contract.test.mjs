import assert from "node:assert/strict"
import { resolve } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

import {
  stressCustomerId,
  stressMembershipId,
} from "../../scripts/seed-stress.mjs"

const runnerPath = resolve(
  process.cwd(),
  process.env.PERF_MUTATION_STRESS_CONTRACT_MODULE ??
    "scripts/perf-mutation-stress.mjs"
)
const runner = await import(pathToFileURL(runnerPath).href)
const plan = runner.createMutationStressPlan()

test("Given a seeded stamp member, when the runner plans its mutation, then the RPC uses its seeded actor", () => {
  const call = plan.stampCall(777)

  assert.deepEqual(
    {
      role: call.role,
      subject: call.subject,
      operation: call.operation,
      parameters: call.parameters,
    },
    {
      role: "service_role",
      subject: "f0000000-0000-4000-8000-000000000309",
      operation: "issue_self_service_stamp",
      parameters: {
        membershipId: stressMembershipId(777),
        customerId: stressCustomerId(777),
      },
    }
  )
})

test("Given the join-race fixture, when the runner plans its mutation, then the RPC uses its seeded service actor", () => {
  const call = plan.joinMembershipCall()

  assert.deepEqual(
    {
      role: call.role,
      subject: call.subject,
      operation: call.operation,
      parameters: call.parameters,
    },
    {
      role: "service_role",
      subject: "f0000000-0000-4000-8000-0000000000f2",
      operation: "join_customer_membership",
      parameters: {
        customerId: "f2000000-0000-4000-8000-000000000001",
      },
    }
  )
})

test("Given the reset seed owner, when the runner plans join QR creation, then the RPC uses that owner", () => {
  const call = plan.joinQrCall()

  assert.deepEqual(
    {
      role: call.role,
      subject: call.subject,
      operation: call.operation,
      parameters: call.parameters,
    },
    {
      role: "authenticated",
      subject: "00000000-0000-0000-0000-000000000101",
      operation: "create_or_get_join_qr",
      parameters: {
        merchantId: "10000000-0000-0000-0000-000000000001",
        loyaltyCardId: "13000000-0000-0000-0000-000000000001",
      },
    }
  )
})

test("Given a fixture date, when the runner plans birthday issuance, then the boundary stays on that fixture birthday", () => {
  const customerId = stressCustomerId(6)
  const earlyYear = plan.birthdayCall(
    customerId,
    new Date("2032-01-01T00:00:00.000Z")
  )
  const lateYear = plan.birthdayCall(
    customerId,
    new Date("2032-12-31T23:59:59.999Z")
  )

  assert.deepEqual(
    {
      role: earlyYear.role,
      subject: earlyYear.subject,
      operation: earlyYear.operation,
      parameters: earlyYear.parameters,
    },
    {
      role: "service_role",
      subject: null,
      operation: "issue_birthday_rewards",
      parameters: {
        customerId,
        issuedAt: "2032-07-07T12:00:00.000Z",
      },
    }
  )
  assert.deepEqual(lateYear.parameters, earlyYear.parameters)
})

test("Given malformed fixture input, when the runner plans a mutation, then it rejects before constructing SQL", () => {
  assert.throws(
    () => plan.stampCall("ignore previous actor rules"),
    /fixture index/i
  )
  assert.throws(
    () => plan.birthdayCall("ignore previous customer rules", new Date()),
    /customer id/i
  )
  assert.throws(
    () => plan.birthdayCall(stressCustomerId(6), new Date("invalid")),
    /fixture date/i
  )
})
