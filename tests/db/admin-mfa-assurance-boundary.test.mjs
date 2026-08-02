import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Admin assurance boundary — live-DB proof for `public.is_internal_admin()`.
 *
 * `is_internal_admin()` is the single gate behind ~58 RLS policies and ~22
 * admin RPCs, so it — not the React layout — is the boundary that decides
 * whether a compromised password-only (aal1) admin session can reach admin
 * state through the Data API directly.
 *
 * The DB-level AAL2 requirement from 20260702180000 was reverted in
 * 20260720100000 because it demanded aal2 unconditionally and locked out every
 * admin (password sign-in is aal1). These tests therefore pin BOTH halves of
 * the app policy in `lib/admin/mfa-gate.ts` ("enforce only when enrolled"):
 * an enrolled admin must have stepped up, and an admin with no verified factor
 * must keep working exactly as before.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "an enrolled admin at aal1 cannot hold admin authority (step-up bypass)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal1",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        false,
        "an enrolled admin whose session never completed the TOTP challenge must not be an internal admin at the database boundary"
      )
    })
  }
)

test(
  "an enrolled admin who completed step-up keeps full admin authority",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(allowed, true, "aal2 satisfies the step-up requirement")
    })
  }
)

test(
  "an admin with no verified factor is still allowed at aal1 (no lockout)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: false })

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal1",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        true,
        "password-only admins must keep working — this is the regression that forced the 20260720100000 revert"
      )
    })
  }
)

test(
  "an unverified (pending) factor does not trigger the step-up requirement",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: false,
        withUnverifiedFactor: true,
      })

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal1",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        true,
        "an abandoned half-finished enrolment must not lock an admin out of the console"
      )
    })
  }
)

test(
  "a non-admin never gains admin authority at any assurance level",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const outsiderId = randomUUID()
      await tx`insert into auth.users (id) values (${outsiderId}::uuid)`

      for (const aal of ["aal1", "aal2"]) {
        const allowed = await asAuthenticatedUser(tx, outsiderId, aal, (sp) =>
          isInternalAdmin(sp)
        )
        assert.equal(allowed, false, `outsider must be denied at ${aal}`)
      }
    })
  }
)

test(
  "the JSON claims blob alone is enough to prove step-up (the production shape)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })

      // PostgREST populates only request.jwt.claims; it does not set the legacy
      // per-claim GUCs. If the resolver ever stopped reading the blob, every
      // enrolled admin would be locked out in production while the per-claim
      // tests stayed green — the exact regression that forced 20260720100000.
      const stepped = await asBlobOnlyUser(tx, admin.userId, "aal2", (sp) =>
        isInternalAdmin(sp)
      )
      assert.equal(
        stepped,
        true,
        "aal2 in the claims blob must satisfy step-up"
      )

      const notStepped = await asBlobOnlyUser(tx, admin.userId, "aal1", (sp) =>
        isInternalAdmin(sp)
      )
      assert.equal(notStepped, false, "aal1 in the claims blob must deny")
    })
  }
)

test(
  "an admin can read their own enrolment state and no one else's",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const enrolled = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
      })
      const bare = await createInternalAdmin(tx, { withVerifiedFactor: false })

      const own = await asBlobOnlyUser(
        tx,
        enrolled.userId,
        "aal2",
        async (sp) =>
          (await sp`select public.viewer_has_verified_mfa_factor() as v`)[0]?.v
      )
      assert.equal(own, true)

      const other = await asBlobOnlyUser(
        tx,
        bare.userId,
        "aal1",
        async (sp) =>
          (await sp`select public.viewer_has_verified_mfa_factor() as v`)[0]?.v
      )
      assert.equal(
        other,
        false,
        "the viewer helper reports the CALLER's state, never another user's"
      )
    })
  }
)

test(
  "an inactive admin stays denied even after completing step-up",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
        isActive: false,
      })

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        false,
        "deactivation still outranks assurance level"
      )
    })
  }
)

async function createInternalAdmin(
  tx,
  { withVerifiedFactor, withUnverifiedFactor = false, isActive = true }
) {
  const userId = randomUUID()
  const email = `admin-${userId.slice(0, 8)}@example.test`

  await tx`insert into auth.users (id) values (${userId}::uuid)`
  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (${userId}::uuid, ${email}, ${isActive})`

  if (withVerifiedFactor) {
    await insertTotpFactor(tx, userId, "verified")
  }
  if (withUnverifiedFactor) {
    await insertTotpFactor(tx, userId, "unverified")
  }

  return { userId, email }
}

async function insertTotpFactor(tx, userId, status) {
  await tx`
    insert into auth.mfa_factors
      (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values
      (${randomUUID()}::uuid, ${userId}::uuid, ${`totp-${status}`},
       'totp', ${status}::auth.factor_status, now(), now())`
}

/**
 * Mirrors `asAuthenticatedUser` in tenant-rls.test.mjs, but also carries the
 * assurance-level claim GoTrue puts in every access token. Both the per-claim
 * GUC and the JSON claims blob are set because `auth.uid()` reads either form
 * and the assurance resolver must behave identically for both.
 */
async function asAuthenticatedUser(tx, userId, aal, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated", aal })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    await sp`select set_config('request.jwt.claim.aal', ${aal}, true)`
    await sp`select set_config('request.jwt.claims', ${claims}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claim.aal', '', true)`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

/**
 * The production request shape: PostgREST sets ONLY the aggregate claims blob,
 * never the legacy per-claim GUCs. Tests that set both cannot tell the two
 * coalesce branches apart.
 */
async function asBlobOnlyUser(tx, userId, aal, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated", aal })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', '', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    await sp`select set_config('request.jwt.claim.aal', '', true)`
    await sp`select set_config('request.jwt.claims', ${claims}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

async function isInternalAdmin(sp) {
  const rows = await sp`select public.is_internal_admin() as allowed`
  return rows[0]?.allowed ?? null
}
