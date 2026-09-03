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

test(
  "wrong push keys cannot transfer another customer's endpoint",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = await verifiedCustomer(tx, hex64())
      const second = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
      const keys = pushKeys()

      await registerPush(tx, first.customerId, endpoint, keys)
      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, second.customerId, endpoint, pushKeys())
          ),
        (error) => error?.code === "42501"
      )

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
        first.customerId,
        "failed continuity proof leaves the existing owner unchanged"
      )
    })
  }
)

test("matching push keys transfer a browser endpoint", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const first = await verifiedCustomer(tx, hex64())
    const second = await verifiedCustomer(tx, hex64())
    const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
    const keys = pushKeys()

    await registerPush(tx, first.customerId, endpoint, keys)
    await registerPush(tx, second.customerId, endpoint, keys)

    const [owner] = await tx`
      select customer_id, failure_reason
      from public.push_subscriptions
      where endpoint = ${endpoint} and enabled and revoked_at is null`
    assert.equal(owner.customer_id, second.customerId)

    const [retired] = await tx`
      select failure_reason
      from public.push_subscriptions
      where endpoint = ${endpoint} and customer_id = ${first.customerId}::uuid`
    assert.equal(retired.failure_reason, "ownership_transferred")
  })
})

test(
  "revoked push history still protects endpoint ownership",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = await verifiedCustomer(tx, hex64())
      const second = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
      const keys = pushKeys()

      await registerPush(tx, first.customerId, endpoint, keys)
      await tx`
      update public.push_subscriptions
      set enabled = false, revoked_at = now(), updated_at = now()
      where customer_id = ${first.customerId}::uuid and endpoint = ${endpoint}`

      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, second.customerId, endpoint, pushKeys())
          ),
        (error) => error?.code === "42501"
      )

      const restoredId = await registerPush(
        tx,
        first.customerId,
        endpoint,
        keys
      )
      assert.ok(restoredId, "the original browser can restore its own endpoint")
    })
  }
)

test(
  "revoked same-customer history requires the existing browser keys",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
      const keys = pushKeys()

      const originalId = await registerPush(
        tx,
        customer.customerId,
        endpoint,
        keys
      )
      await tx`
        select public.disable_push_subscription_for_customer(
          ${customer.customerId}::uuid, ${endpoint}, 'customer-disabled')`

      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, customer.customerId, endpoint, pushKeys())
          ),
        (error) => error?.code === "42501"
      )

      const [afterRejected] = await tx`
        select id, enabled, revoked_at, p256dh, auth
        from public.push_subscriptions
        where customer_id = ${customer.customerId}::uuid
          and endpoint = ${endpoint}`
      assert.equal(afterRejected.id, originalId)
      assert.equal(afterRejected.enabled, false)
      assert.notEqual(afterRejected.revoked_at, null)
      assert.equal(afterRejected.p256dh, keys.p256dh)
      assert.equal(afterRejected.auth, keys.auth)

      const restoredId = await registerPush(
        tx,
        customer.customerId,
        endpoint,
        keys
      )
      assert.equal(restoredId, originalId)
      const [restored] = await tx`
        select enabled, revoked_at
        from public.push_subscriptions
        where id = ${originalId}::uuid`
      assert.equal(restored.enabled, true)
      assert.equal(restored.revoked_at, null)
    })
  }
)

test(
  "touching stale push history cannot reclaim another customer's endpoint",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const first = await verifiedCustomer(tx, hex64())
      const second = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
      const keys = pushKeys()

      await registerPush(tx, first.customerId, endpoint, keys)
      await registerPush(tx, second.customerId, endpoint, keys)

      // A former owner can legitimately disable its historical row. That
      // mutable touch must not make the stale row authoritative over B's
      // active ownership.
      await tx`
        select public.disable_push_subscription_for_customer(
          ${first.customerId}::uuid, ${endpoint}, 'stale-history-touch')`

      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, first.customerId, endpoint, pushKeys())
          ),
        (error) => error?.code === "42501"
      )

      const [activeOwner] = await tx`
        select customer_id
        from public.push_subscriptions
        where endpoint = ${endpoint} and enabled and revoked_at is null`
      assert.equal(activeOwner.customer_id, second.customerId)

      // Once the active row is revoked, immutable revocation chronology still
      // makes the most recent owner B the continuity anchor.
      await tx`
        select public.disable_push_subscription_for_customer(
          ${second.customerId}::uuid, ${endpoint}, 'current-owner-disabled')`

      const history = await tx`
        select customer_id, revoked_at, created_at, continuity_version
        from public.push_subscriptions
        where endpoint = ${endpoint}
        order by continuity_version`
      assert.equal(history.length, 2)
      assert.equal(
        history[0].revoked_at.getTime(),
        history[1].revoked_at.getTime(),
        "the regression fixture must exercise a transaction-timestamp tie"
      )
      assert.equal(
        history[0].created_at.getTime(),
        history[1].created_at.getTime(),
        "the regression fixture must also tie row creation timestamps"
      )
      assert.ok(
        BigInt(history[1].continuity_version) >
          BigInt(history[0].continuity_version),
        "the immutable event sequence must retain B as the newest owner"
      )
      assert.equal(history[1].customer_id, second.customerId)

      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, first.customerId, endpoint, pushKeys())
          ),
        (error) => error?.code === "42501"
      )
    })
  }
)

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

test(
  "ambiguous legacy ownership is quarantined instead of guessed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const customer = await verifiedCustomer(tx, hex64())
      const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
      const keys = pushKeys()
      await registerPush(tx, customer.customerId, endpoint, keys)
      await tx`
        update public.push_subscriptions
        set enabled = false,
            revoked_at = now(),
            continuity_trusted = false
        where customer_id = ${customer.customerId}::uuid
          and endpoint = ${endpoint}`

      await assert.rejects(
        () =>
          tx.savepoint((sp) =>
            registerPush(sp, customer.customerId, endpoint, keys)
          ),
        (error) =>
          error?.code === "42501" && /reconciliation/i.test(error.message)
      )
    })
  }
)

test(
  "push continuity sequence is not callable by API roles",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`
      select
        has_sequence_privilege(
          'anon',
          'public.push_subscription_continuity_version_seq',
          'USAGE'
        ) as anon_usage,
        has_sequence_privilege(
          'authenticated',
          'public.push_subscription_continuity_version_seq',
          'USAGE'
        ) as authenticated_usage`
      assert.equal(row.anon_usage, false)
      assert.equal(row.authenticated_usage, false)
    })
  }
)

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

async function createInvite(tx, merchantId, opts = {}) {
  const unsubscribeTokenHash = Object.hasOwn(opts, "unsubscribeTokenHash")
    ? opts.unsubscribeTokenHash
    : opts.emailHmac
      ? hex64()
      : null
  const [row] = await tx`
    select * from public.create_merchant_reward_invite(
      ${merchantId}::uuid, ${opts.emailHmac ?? null}, ${opts.phoneHmac ?? null},
      ${opts.emailHmac ? "r***@example.com" : null},
      ${opts.phoneHmac ? "4242" : null},
      'A drink on us', 'A drink on us — thanks for being a regular.',
      null, 30, ${opts.tokenHash ?? hex64()},
      ${unsubscribeTokenHash})`
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

function pushKeys() {
  return {
    p256dh: `p256dh-${randomUUID()}`,
    auth: `auth-${randomUUID()}`,
  }
}

async function registerPush(tx, customerId, endpoint, keys = pushKeys()) {
  const [row] = await tx`
    select public.register_push_subscription_for_customer(
      ${customerId}::uuid, ${endpoint}, ${keys.p256dh},
      ${keys.auth}, 'test-agent', 'granted') as id`
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
  "a claim-only token cannot mutate venue email suppression",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venueA = await createRewardPoolFixture(tx)
      const venueB = await createRewardPoolFixture(tx)
      const emailHmac = hex64()
      const claimHash = hex64()
      const unsubscribeHash = hex64()

      // A null unsubscribe hash is not a trustworthy legacy marker: current
      // callers could manufacture it, and the public legacy query route is no
      // longer active. Claim authority must remain purpose-bound.
      await createInvite(tx, venueA.merchantId, {
        emailHmac,
        tokenHash: claimHash,
        unsubscribeTokenHash: unsubscribeHash,
      })

      const [row] = await tx`
        select public.suppress_reward_invite_email_by_token(${claimHash}) as ok`
      assert.equal(row.ok, false, "claim tokens must not unsubscribe")

      assert.equal(await isSuppressed(tx, venueA.merchantId, emailHmac), false)
      assert.equal(
        await isSuppressed(tx, venueB.merchantId, emailHmac),
        false,
        "an unrelated venue also remains unchanged"
      )
    })
  }
)

test(
  "new reward invite capabilities cannot overlap across purposes",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venue = await createRewardPoolFixture(tx)
      const sharedHash = hex64()
      await assert.rejects(() =>
        tx.savepoint((sp) =>
          createInvite(sp, venue.merchantId, {
            emailHmac: hex64(),
            tokenHash: sharedHash,
            unsubscribeTokenHash: sharedHash,
          })
        )
      )

      const firstClaim = hex64()
      await createInvite(tx, venue.merchantId, {
        emailHmac: hex64(),
        tokenHash: firstClaim,
        unsubscribeTokenHash: hex64(),
      })
      await assert.rejects(() =>
        tx.savepoint((sp) =>
          createInvite(sp, venue.merchantId, {
            emailHmac: hex64(),
            tokenHash: hex64(),
            unsubscribeTokenHash: firstClaim,
          })
        )
      )

      const firstUnsubscribe = hex64()
      await createInvite(tx, venue.merchantId, {
        emailHmac: hex64(),
        tokenHash: hex64(),
        unsubscribeTokenHash: firstUnsubscribe,
      })
      await assert.rejects(() =>
        tx.savepoint((sp) =>
          createInvite(sp, venue.merchantId, {
            phoneHmac: hex64(),
            tokenHash: firstUnsubscribe,
            unsubscribeTokenHash: null,
          })
        )
      )
    })
  }
)
