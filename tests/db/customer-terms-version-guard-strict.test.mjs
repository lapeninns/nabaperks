import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

// QA BUG-037 (38c42a1..2c45031): the terms version guard only refused
// well-formed dated versions without a snapshot trigger. Anything shaped
// differently fell through, and the join stored its outdated built-in venue
// terms under that label. The guard now refuses by default: a version is
// admitted only when it is a dated version before 2026-09-26, a dated version
// whose snapshot trigger is installed, or a plain fixture name.

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

async function joinFixture(tx) {
  const [fixture] = await tx`
    select qr.qr_id, merchants.business_slug
    from public.qr_codes qr
    join public.merchants merchants on merchants.id = qr.merchant_id
    where qr.is_active and qr.destination_type = 'join'
    order by qr.created_at limit 1`
  assert.ok(fixture)
  return fixture
}

async function newCustomer(tx) {
  const [customer] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`terms-guard-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  return customer.id
}

const MALFORMED = [
  "2026-09-28.0",
  "2026-09-28.01",
  "2026-9-30",
  "2026-10-01T00:00",
  "v2026-10-01",
  "2026-10-01.1a",
  "2026/10/01",
  "20261001",
  "2026-10-01.1.1",
  "2026-10-01_1",
  "2026-10-01 .1",
  "2026-06-foundation",
]

test(
  "Given a malformed or dated-looking terms version When a customer joins Then the join is refused and nothing is recorded",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinFixture(tx)
      for (const version of MALFORMED) {
        const customerId = await newCustomer(tx)
        await assert.rejects(
          () =>
            tx.savepoint(
              (sp) => sp`
                select * from public.join_customer_membership(
                  ${customerId}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
                  false, ${version}
                )`
            ),
          (error) => {
            assert.equal(error.code, "55000", JSON.stringify(version))
            return true
          }
        )
        const [counts] = await tx`
          select
            (select count(*)::int from public.customer_memberships
              where customer_id = ${customerId}::uuid) as memberships,
            (select count(*)::int from public.customer_loyalty_terms_acceptances
              where customer_id = ${customerId}::uuid) as acceptances`
        assert.deepEqual(
          counts,
          { memberships: 0, acceptances: 0 },
          JSON.stringify(version)
        )
      }
    })
  }
)

test(
  "Given current, earlier and fixture terms versions When a customer joins Then the join is still accepted",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await joinFixture(tx)
      for (const version of [
        "2026-09-28.1",
        "2026-09-28",
        "2026-09-26",
        "2026-08-01",
        "2026-07-19",
        "2026-06-06",
        "phone-test-v1",
        "staging-release-v1",
        "stress-test",
      ]) {
        const customerId = await newCustomer(tx)
        const [joined] = await tx`
          select * from public.join_customer_membership(
            ${customerId}::uuid, ${fixture.business_slug}, ${fixture.qr_id},
            false, ${version}
          )`
        assert.equal(joined.created_membership, true, version)
      }
    })
  }
)
