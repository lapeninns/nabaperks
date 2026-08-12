import { mock } from "node:test"

const [kind, scenario] = process.argv.slice(2)
const counters = { hash: 0, rpc: 0, materialized: 0 }

if (kind === "invite" || kind === "offer") {
  mock.module("@/lib/loyalty-invites/tokens", {
    namedExports: {
      hashInviteToken: () => {
        counters.hash += 1
        return "invite-hash"
      },
    },
  })
  mock.module("@/lib/offers/tokens", {
    namedExports: {
      hashOfferToken: () => {
        counters.hash += 1
        return "offer-hash"
      },
    },
  })
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServiceRoleClient: () => ({
        rpc: async (name) => {
          counters.rpc += 1
          if (name === "get_loyalty_invite_claim_context") {
            return {
              data: {
                claim_status: "available",
                business_name: "Synthetic venue",
                business_slug: "synthetic-venue",
              },
              error: null,
            }
          }
          return {
            data: {
              claim_status: "available",
              business_name: "Synthetic venue",
              business_slug: "synthetic-venue",
            },
            error: null,
          }
        },
      }),
    },
  })

  const token = scenario === "oversized" ? "x".repeat(1_025) : "opaque-token"
  const result =
    kind === "invite"
      ? await (
          await import("@/lib/loyalty-invites/claim-context")
        ).resolveInviteClaimContext(token)
      : await (
          await import("@/lib/offers/claim-context")
        ).resolveOfferClaimContext(token)
  process.stdout.write(
    JSON.stringify({
      status: result.status,
      hashEffects: counters.hash,
      rpcEffects: counters.rpc,
    })
  )
} else {
  const customerId = "customer-owner"
  const row = {
    id: "entitlement-target",
    customer_id: scenario === "owned" ? customerId : "customer-foreign",
    membership_id: "membership-one",
    discount_percent: 15,
    requires_id_check: false,
    extra_terms: null,
    status: "active",
    valid_from: "2000-01-01",
    valid_to: "2100-01-01",
    merchants: {
      business_name: "Synthetic venue",
      business_slug: "synthetic-venue",
      status: "active",
      requires_billing: false,
      billing_customers: null,
      loyalty_cards: { is_active: true },
    },
  }
  const predicates = new Map()
  const query = {
    select: () => query,
    eq: (column, value) => {
      predicates.set(column, value)
      return query
    },
    maybeSingle: async () => {
      if (scenario === "hung") {
        setInterval(() => undefined, 1_000)
        await new Promise(() => {})
      }
      const matches = [...predicates].every(
        ([column, value]) => row[column] === value
      )
      if (!matches) return { data: null, error: null }
      counters.materialized += 1
      return { data: row, error: null }
    },
  }
  mock.module("@/lib/customer/identity", {
    namedExports: { getCurrentCustomer: async () => ({ id: customerId }) },
  })
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServiceRoleClient: () => ({ from: () => query }),
    },
  })
  const result = await (
    await import("@/lib/customer/offer-pass")
  ).loadCustomerOfferPass("entitlement-target")
  process.stdout.write(
    JSON.stringify({
      status: result.status,
      customerPredicate: predicates.has("customer_id"),
      materializedRows: counters.materialized,
    })
  )
}
