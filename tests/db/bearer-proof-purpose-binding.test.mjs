import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * Bearer proofs must be bound to a purpose and to an identity.
 *
 * A token may LOCATE a record; it must not, on its own, authorise the effect.
 * Covers: direct-reward-token-contact-bypass, claim-token-global-unsubscribe,
 * push-subscription-cross-customer-reuse.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "a leaked claim token does not let the wrong customer take the reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const recipientEmail = hex64()
      const tokenHash = hex64()

      await createInvite(tx, fixture.merchantId, {
        emailHmac: recipientEmail,
        tokenHash,
      })

      const attacker = await verifiedCustomer(tx, hex64())

      const attached = await attach(tx, attacker.customerId, {
        email: attacker.emailHmac,
        token: tokenHash,
      })

      assert.equal(
        attached.length,
        0,
        "possession of the claim URL is not proof of being the invited contact"
      )

      const [invite] = await tx`
        select status, matched_customer_id, claim_token_hash
        from public.pending_reward_invites
        where claim_token_hash = ${tokenHash}`

      assert.equal(
        invite.matched_customer_id,
        null,
        "the wrong claimant must not be able to reserve the invite (a denial-of-service primitive)"
      )
      assert.equal(invite.status, "pending")
    })
  }
)

test(
  "the invited contact still claims their reward through the same token",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const recipientEmail = hex64()
      const tokenHash = hex64()

      await createInvite(tx, fixture.merchantId, {
        emailHmac: recipientEmail,
        tokenHash,
      })

      // The genuine recipient: same verified email HMAC, and a member so the
      // reward can actually be minted.
      await tx`
        update public.customers set email_hmac = ${recipientEmail}
        where id = ${fixture.customerId}::uuid`

      const attached = await attach(tx, fixture.customerId, {
        email: recipientEmail,
        token: tokenHash,
      })

      assert.ok(
        attached.length > 0,
        "the invited, verified contact must still be able to claim"
      )
    })
  }
)

test(
  "contact-driven attach with no token at all still works",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const recipientEmail = hex64()

      await createInvite(tx, fixture.merchantId, { emailHmac: recipientEmail })
      await tx`
        update public.customers set email_hmac = ${recipientEmail}
        where id = ${fixture.customerId}::uuid`

      const attached = await attach(tx, fixture.customerId, {
        email: recipientEmail,
      })

      assert.ok(
        attached.length > 0,
        "the background attach on join/verify carries no token and must keep working"
      )
    })
  }
)

test(
  "unsubscribing one venue does not suppress every other venue",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venueA = await createRewardPoolFixture(tx)
      const venueB = await createRewardPoolFixture(tx)
      const emailHmac = hex64()

      await suppress(tx, venueA.merchantId, emailHmac, "unsubscribed")

      assert.equal(
        await isSuppressed(tx, venueA.merchantId, emailHmac),
        true,
        "the venue the recipient unsubscribed from must be suppressed"
      )
      assert.equal(
        await isSuppressed(tx, venueB.merchantId, emailHmac),
        false,
        "one venue's unsubscribe link must not carry authority over another venue"
      )
    })
  }
)

test(
  "a legacy global suppression is still honoured for every venue",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venue = await createRewardPoolFixture(tx)
      const emailHmac = hex64()

      // Rows written before this change carry no merchant scope. They must keep
      // suppressing everywhere: narrowing them would silently re-enable mail to
      // people who already opted out.
      await tx`
        insert into public.reward_invite_email_suppressions (email_hmac, reason)
        values (${emailHmac}, 'unsubscribed')`

      assert.equal(
        await isSuppressed(tx, venue.merchantId, emailHmac),
        true,
        "legacy unscoped opt-outs must continue to suppress"
      )
    })
  }
)

test("one push endpoint keeps at most one active owner", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const first = await verifiedCustomer(tx, hex64())
    const second = await verifiedCustomer(tx, hex64())
    const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`

    await registerPush(tx, first.customerId, endpoint)
    await registerPush(tx, second.customerId, endpoint)

    const [{ owners }] = await tx`
        select count(*)::int as owners
        from public.push_subscriptions
        where endpoint = ${endpoint}
          and enabled
          and revoked_at is null`

    assert.equal(
      owners,
      1,
      "a browser endpoint belongs to a device, not an account — the previous owner must be retired"
    )

    const [{ customer_id: owner }] = await tx`
        select customer_id from public.push_subscriptions
        where endpoint = ${endpoint} and enabled and revoked_at is null`

    assert.equal(
      owner,
      second.customerId,
      "the newest signed-in customer owns it"
    )
  })
})

test(
  "re-registering the same endpoint for the same customer stays idempotent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`

      const firstId = await registerPush(tx, customer.customerId, endpoint)
      const secondId = await registerPush(tx, customer.customerId, endpoint)

      assert.equal(secondId, firstId, "duplicate register reuses the row id")
    })
  }
)

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

async function createInvite(tx, merchantId, opts = {}) {
  const [row] = await tx`
    select * from public.create_merchant_reward_invite(
      ${merchantId}::uuid, ${opts.emailHmac ?? null}, ${opts.phoneHmac ?? null},
      ${opts.emailHmac ? "r***@example.com" : null},
      ${opts.phoneHmac ? "4242" : null},
      'A drink on us', 'A drink on us — thanks for being a regular.',
      null, 30, ${opts.tokenHash ?? hex64()},
      ${opts.unsubscribeTokenHash ?? null})`
  return row
}

function attach(
  tx,
  customerId,
  { phone = null, email = null, token = null } = {}
) {
  return tx`
    select * from public.attach_matched_reward_invites(
      ${customerId}::uuid, ${phone}, ${email}, ${token})`
}

async function verifiedCustomer(tx, emailHmac) {
  const authId = randomUUID()
  const customerId = randomUUID()
  await tx`insert into auth.users (id) values (${authId}::uuid)`
  await tx`
    insert into public.customers
      (id, auth_user_id, email, email_hmac, email_verified_at, phone_last4)
    values
      (${customerId}::uuid, ${authId}::uuid,
       ${`c-${customerId.slice(0, 8)}@example.test`}, ${emailHmac}, now(), '4321')`
  return { customerId, emailHmac }
}

function suppress(tx, merchantId, emailHmac, reason) {
  return tx`
    select public.suppress_reward_invite_email(
      ${merchantId}::uuid, ${emailHmac}, ${reason})`
}

async function isSuppressed(tx, merchantId, emailHmac) {
  const [row] = await tx`
    select public.reward_invite_email_suppressed(
      ${merchantId}::uuid, ${emailHmac}) as suppressed`
  return row.suppressed
}

async function registerPush(tx, customerId, endpoint) {
  const [row] = await tx`
    select public.register_push_subscription_for_customer(
      ${customerId}::uuid, ${endpoint}, ${`p256dh-${randomUUID()}`},
      ${`auth-${randomUUID()}`}, 'test-agent', 'granted') as id`
  return row.id
}

test(
  "a recipient who claimed their reward can still unsubscribe",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const emailHmac = hex64()
      const claimHash = hex64()
      const unsubHash = hex64()

      await createInvite(tx, fixture.merchantId, {
        emailHmac,
        tokenHash: claimHash,
        unsubscribeTokenHash: unsubHash,
      })
      await tx`
        update public.customers set email_hmac = ${emailHmac}
        where id = ${fixture.customerId}::uuid`

      // Claiming scrubs the invite's contact hashes.
      await attach(tx, fixture.customerId, {
        email: emailHmac,
        token: claimHash,
      })
      const [invite] = await tx`
        select email_hmac from public.pending_reward_invites
        where unsubscribe_token_hash = ${unsubHash}`
      assert.equal(invite.email_hmac, null, "attach scrubs the invite contact")

      // ...but the unsubscribe link in their inbox must still work, resolving
      // through the customer the reward was attached to.
      const [row] = await tx`
        select public.suppress_reward_invite_email_by_token(${unsubHash}) as ok`
      assert.equal(row.ok, true, "opting out must survive claiming")
      assert.equal(await isSuppressed(tx, fixture.merchantId, emailHmac), true)
    })
  }
)

test(
  "an unsubscribe link already in an inbox keeps working, venue-scoped",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venueA = await createRewardPoolFixture(tx)
      const venueB = await createRewardPoolFixture(tx)
      const emailHmac = hex64()
      const legacyClaimHash = hex64()

      // Emails sent before the token split carry /claim/<claimToken>?unsubscribe=1
      // and nothing else. Breaking them would strip a live opt-out route.
      await createInvite(tx, venueA.merchantId, {
        emailHmac,
        tokenHash: legacyClaimHash,
      })

      const [row] = await tx`
        select public.suppress_reward_invite_email_by_token(${legacyClaimHash}) as ok`
      assert.equal(row.ok, true, "legacy links must still unsubscribe")

      assert.equal(await isSuppressed(tx, venueA.merchantId, emailHmac), true)
      assert.equal(
        await isSuppressed(tx, venueB.merchantId, emailHmac),
        false,
        "but only for the venue that sent it — the global scope was the finding"
      )
    })
  }
)
