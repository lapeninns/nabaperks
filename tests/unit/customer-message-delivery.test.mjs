import assert from "node:assert/strict"
import test from "node:test"

import { deliverCustomerPhoneChannel } from "../../lib/notifications/customer-message-delivery.ts"

const deliveryInput = {
  event: {
    id: "00000000-0000-4000-8000-000000000001",
    event_type: "reward_ready",
    customer_id: "00000000-0000-4000-8000-000000000002",
    merchant_id: "00000000-0000-4000-8000-000000000003",
    payload: {},
  },
  channel: "sms",
  recipient: { e164: "+447700900123", last4: "0123" },
  category: "transactional",
  copy: { smsBody: "Fixture", whatsappVariables: {} },
  dryRun: false,
}

function serviceClient(rpc) {
  const query = {
    select() {
      return query
    },
    eq() {
      return query
    },
    order() {
      return query
    },
    async limit() {
      return { data: [], error: null }
    },
  }
  return {
    rpc,
    from() {
      return query
    },
  }
}

test("Given a replayed channel When delivery runs Then one atomic admission rejects it before any provider attempt", async (t) => {
  t.mock.method(Date, "now", () => 1_000_000)
  const rpcCalls = []
  const provider = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected provider attempt")
  })
  const supabase = serviceClient(async (name) => {
    rpcCalls.push(name)
    if (name === "admit_customer_message_dispatch")
      return { data: true, error: null }
    return {
      data: null,
      error: { code: "NBM01", message: "Phone delivery already admitted" },
    }
  })

  const outcome = await deliverCustomerPhoneChannel({
    ...deliveryInput,
    supabase,
  })

  assert.equal(outcome.status, "defer")
  assert.equal(outcome.dueAt.getTime(), 1_000_000 + 5 * 60_000)
  assert.deepEqual(rpcCalls, ["admit_notification_message_delivery"])
  assert.equal(provider.mock.callCount(), 0)
})

test("Given an exhausted budget When delivery runs Then atomic refusal stays retryable without a provider attempt", async (t) => {
  t.mock.method(Date, "now", () => 1_000_000)
  const rpcCalls = []
  const provider = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected provider attempt")
  })
  const supabase = serviceClient(async (name) => {
    rpcCalls.push(name)
    return { data: null, error: null }
  })

  const outcome = await deliverCustomerPhoneChannel({
    ...deliveryInput,
    supabase,
  })

  assert.equal(outcome.status, "defer")
  assert.equal(outcome.dueAt.getTime(), 1_000_000 + 60 * 60_000)
  assert.deepEqual(rpcCalls, ["admit_notification_message_delivery"])
  assert.equal(provider.mock.callCount(), 0)
})

test("Given messaging mode off When atomic admission succeeds Then the delivery is closed without a provider attempt", async (t) => {
  t.mock.property(process, "env", {
    ...process.env,
    CUSTOMER_MESSAGING_MODE: "off",
  })
  const rpcCalls = []
  const provider = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected provider attempt")
  })
  const supabase = serviceClient(async (name) => {
    rpcCalls.push(name)
    if (name === "admit_notification_message_delivery") {
      return {
        data: "00000000-0000-4000-8000-000000000004",
        error: null,
      }
    }
    return { data: true, error: null }
  })

  const outcome = await deliverCustomerPhoneChannel({
    ...deliveryInput,
    supabase,
  })

  assert.deepEqual(outcome, { status: "continue", failed: false })
  assert.deepEqual(rpcCalls, [
    "admit_notification_message_delivery",
    "finish_notification_message_delivery",
  ])
  assert.equal(provider.mock.callCount(), 0)
})
