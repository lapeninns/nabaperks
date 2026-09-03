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
 * Authority requires an independently activated verified factor and AAL2.
 * Password-only and pending-factor states remain enrolment-only and must not
 * gain authority through the Data API.
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
  "trusted activation binds only the sole verified TOTP factor and is audited",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
        activateVerifiedFactor: false,
      })
      const [factor] = await tx`
        select id
        from auth.mfa_factors
        where user_id = ${admin.userId}::uuid`

      const [{ activated }] = await tx`
        select public.activate_internal_admin_mfa(
          ${admin.userId}::uuid, ${factor.id}::uuid
        ) as activated`
      assert.equal(activated, true)

      const [audit] = await tx`
        select action, target_id, metadata
        from public.audit_logs
        where target_id = ${admin.userId}::uuid
          and action = 'admin_mfa_factor_activated'`
      assert.equal(audit.action, "admin_mfa_factor_activated")
      assert.equal(audit.target_id, admin.userId)
      assert.equal(audit.metadata.factor_id, factor.id)

      await assert.rejects(
        () =>
          asAuthenticatedUser(
            tx,
            admin.userId,
            "aal2",
            (sp) =>
              sp`
              select public.activate_internal_admin_mfa(
                ${admin.userId}::uuid, ${factor.id}::uuid
              )`
          ),
        (error) => error?.code === "42501"
      )
    })
  }
)

test(
  "an active admin with no verified factor is denied at aal1 and aal2",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: false })

      for (const aal of ["aal1", "aal2"]) {
        const allowed = await asAuthenticatedUser(tx, admin.userId, aal, (sp) =>
          isInternalAdmin(sp)
        )
        assert.equal(allowed, false, `password-only admin denied at ${aal}`)
      }
    })
  }
)

test(
  "a browser-verified but unbound factor remains enrolment-only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
        activateVerifiedFactor: false,
      })

      for (const aal of ["aal1", "aal2"]) {
        const allowed = await asAuthenticatedUser(tx, admin.userId, aal, (sp) =>
          isInternalAdmin(sp)
        )
        assert.equal(
          allowed,
          false,
          `browser enrolment without trusted activation is denied at ${aal}`
        )
      }
    })
  }
)

test(
  "an unverified pending factor cannot activate admin authority",
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
        false,
        "an abandoned or attacker-created pending factor grants no authority"
      )
    })
  }
)

test(
  "a second verified factor invalidates the trusted admin factor binding",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })
      await insertTotpFactor(tx, admin.userId, "verified")

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        false,
        "an unapproved second factor must fail closed even with an aal2 session"
      )

      const [binding] = await tx`
        select mfa_factor_id
        from public.internal_admins
        where user_id = ${admin.userId}::uuid`
      assert.equal(
        binding.mfa_factor_id,
        null,
        "factor-set changes invalidate trusted activation monotonically"
      )
    })
  }
)

test(
  "deleting an unapproved factor cannot revive a stale aal2 session",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })
      const unapprovedFactor = await insertTotpFactor(
        tx,
        admin.userId,
        "verified"
      )
      await tx`
        delete from auth.mfa_factors
        where id = ${unapprovedFactor}::uuid`

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(
        allowed,
        false,
        "the old token stays denied after the extra factor disappears"
      )

      const [audit] = await tx`
        select action, metadata
        from public.audit_logs
        where target_id = ${admin.userId}::uuid
          and action = 'admin_mfa_binding_invalidated'
        order by created_at desc
        limit 1`
      assert.equal(audit.action, "admin_mfa_binding_invalidated")
      assert.equal(audit.metadata.factor_operation, "insert")
    })
  }
)

test(
  "a token challenged for an old factor stays denied after replacement activation",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: true })
      const [initial] = await tx`
        select mfa_factor_id::text as mfa_factor_id
        from public.internal_admins
        where user_id = ${admin.userId}::uuid`

      await tx`select set_config('app.admin_mfa_binding_change', 'trusted_activation', true)`
      await tx`
        update public.internal_admins
        set mfa_activated_at = clock_timestamp() - interval '10 seconds'
        where user_id = ${admin.userId}::uuid`
      await tx`select set_config('app.admin_mfa_binding_change', '', true)`

      const sessionId = randomUUID()
      const oldChallengeAt = new Date(Date.now() - 5_000)
      await tx`
        insert into auth.sessions
          (id, user_id, created_at, updated_at, factor_id, aal)
        values (
          ${sessionId}::uuid,
          ${admin.userId}::uuid,
          ${oldChallengeAt},
          ${oldChallengeAt},
          ${initial.mfa_factor_id}::uuid,
          'aal2'::auth.aal_level
        )`
      await tx`
        insert into auth.mfa_amr_claims
          (id, session_id, created_at, updated_at, authentication_method)
        values (
          ${randomUUID()}::uuid,
          ${sessionId}::uuid,
          ${oldChallengeAt},
          ${oldChallengeAt},
          'totp'
        )`
      const oldClaims = {
        sub: admin.userId,
        role: "authenticated",
        aal: "aal2",
        session_id: sessionId,
        amr: [
          {
            method: "totp",
            timestamp: Math.floor(oldChallengeAt.getTime() / 1_000),
          },
        ],
      }

      const replacementFactor = await insertTotpFactor(
        tx,
        admin.userId,
        "verified"
      )
      await tx`
        delete from auth.mfa_factors
        where id = ${initial.mfa_factor_id}::uuid`
      await tx`
        select public.activate_internal_admin_mfa(
          ${admin.userId}::uuid, ${replacementFactor}::uuid
        )`
      const [replacement] = await tx`
        select mfa_activated_at
        from public.internal_admins
        where user_id = ${admin.userId}::uuid`
      assert.equal(
        new Date(replacement.mfa_activated_at).getMilliseconds(),
        0,
        "activation advances to a whole-second JWT timestamp boundary"
      )
      const newChallengeAt = new Date(
        new Date(replacement.mfa_activated_at).getTime() + 1_000
      )

      // A legitimate challenge updates the authoritative session and produces
      // a new JWT. The stolen old JWT has the same session id but retains its
      // old signed AMR timestamp, so it must not inherit the new challenge.
      await tx`
        update auth.sessions
        set factor_id = ${replacementFactor}::uuid,
            aal = 'aal2'::auth.aal_level
        where id = ${sessionId}::uuid`
      await tx`
        update auth.mfa_amr_claims
        set updated_at = ${newChallengeAt}
        where session_id = ${sessionId}::uuid
          and authentication_method = 'totp'`

      const staleAllowed = await asBlobClaimsUser(
        tx,
        admin.userId,
        oldClaims,
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(
        staleAllowed,
        false,
        "an old signed token cannot borrow a post-activation session challenge"
      )

      const freshAllowed = await asBlobClaimsUser(
        tx,
        admin.userId,
        {
          ...oldClaims,
          amr: [
            {
              method: "totp",
              timestamp: Math.floor(newChallengeAt.getTime() / 1_000),
            },
          ],
        },
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(
        freshAllowed,
        true,
        "the replacement factor grants authority only to its fresh token"
      )
    })
  }
)

test(
  "direct service-role binding changes are rejected outside the audited RPC",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
        activateVerifiedFactor: false,
      })
      const [factor] = await tx`
        select id
        from auth.mfa_factors
        where user_id = ${admin.userId}::uuid`

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
          update public.internal_admins
          set mfa_factor_id = ${factor.id}::uuid
          where user_id = ${admin.userId}::uuid`
          ),
        /audited admin MFA lifecycle boundary/i
      )
    })
  }
)

test(
  "removing an unbound verified admin factor is still audited",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
        activateVerifiedFactor: false,
      })
      const [factor] = await tx`
        select id from auth.mfa_factors
        where user_id = ${admin.userId}::uuid`

      await tx`delete from auth.mfa_factors where id = ${factor.id}::uuid`

      const [audit] = await tx`
        select action, metadata
        from public.audit_logs
        where target_id = ${admin.userId}::uuid
          and action = 'admin_mfa_factor_unenrolled'
        order by created_at desc
        limit 1`
      assert.equal(audit.action, "admin_mfa_factor_unenrolled")
      assert.equal(audit.metadata.factor_id, factor.id)
      assert.equal(audit.metadata.factor_operation, "delete")
    })
  }
)

test(
  "a factor owned by another admin cannot replace the trusted binding",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const trustedAdmin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
      })
      const otherAdmin = await createInternalAdmin(tx, {
        withVerifiedFactor: true,
      })

      const [otherBinding] = await tx`
        select mfa_factor_id
        from public.internal_admins
        where user_id = ${otherAdmin.userId}::uuid`
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
          select public.activate_internal_admin_mfa(
            ${trustedAdmin.userId}::uuid, ${otherBinding.mfa_factor_id}::uuid
          )`
          ),
        (error) => error?.code === "42501"
      )

      const allowed = await asAuthenticatedUser(
        tx,
        trustedAdmin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )

      assert.equal(
        allowed,
        true,
        "a rejected replacement leaves the original trusted factor active"
      )
    })
  }
)

test(
  "a bound verified non-TOTP factor cannot activate authority",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const admin = await createInternalAdmin(tx, { withVerifiedFactor: false })
      const factorId = await insertMfaFactor(
        tx,
        admin.userId,
        "verified",
        "phone"
      )
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
          select public.activate_internal_admin_mfa(
            ${admin.userId}::uuid, ${factorId}::uuid
          )`
          ),
        (error) => error?.code === "42501"
      )

      const allowed = await asAuthenticatedUser(
        tx,
        admin.userId,
        "aal2",
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(
        allowed,
        false,
        "only the supported TOTP factor can activate"
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
  {
    withVerifiedFactor,
    withUnverifiedFactor = false,
    isActive = true,
    activateVerifiedFactor = withVerifiedFactor,
  }
) {
  const userId = randomUUID()
  const email = `admin-${userId.slice(0, 8)}@example.test`

  await tx`insert into auth.users (id) values (${userId}::uuid)`
  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (${userId}::uuid, ${email}, ${isActive})`

  if (withVerifiedFactor) {
    const factorId = await insertTotpFactor(tx, userId, "verified")
    if (activateVerifiedFactor && isActive) {
      await tx`
        select public.activate_internal_admin_mfa(
          ${userId}::uuid, ${factorId}::uuid
        )`
    }
  }
  if (withUnverifiedFactor) {
    await insertTotpFactor(tx, userId, "unverified")
  }

  return { userId, email }
}

async function insertTotpFactor(tx, userId, status) {
  return insertMfaFactor(tx, userId, status, "totp")
}

async function insertMfaFactor(tx, userId, status, factorType) {
  const factorId = randomUUID()
  await tx`
    insert into auth.mfa_factors
      (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values
      (${factorId}::uuid, ${userId}::uuid, ${`${factorType}-${status}-${factorId}`},
       ${factorType}::auth.factor_type, ${status}::auth.factor_status, now(), now())`
  return factorId
}

/**
 * Mirrors `asAuthenticatedUser` in tenant-rls.test.mjs, but also carries the
 * assurance-level claim GoTrue puts in every access token. Both the per-claim
 * GUC and the JSON claims blob are set because `auth.uid()` reads either form
 * and the assurance resolver must behave identically for both.
 */
async function asAuthenticatedUser(tx, userId, aal, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify(
      await claimsWithCurrentMfaEvidence(sp, userId, aal)
    )
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
    const claims = JSON.stringify(
      await claimsWithCurrentMfaEvidence(sp, userId, aal)
    )
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

async function asBlobClaimsUser(tx, userId, claims, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', '', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    await sp`select set_config('request.jwt.claim.aal', '', true)`
    await sp`
      select set_config(
        'request.jwt.claims',
        ${JSON.stringify(claims)},
        true
      )`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

async function claimsWithCurrentMfaEvidence(tx, userId, aal) {
  const claims = { sub: userId, role: "authenticated", aal }
  if (aal !== "aal2") return claims

  const [activation] = await tx`
    select mfa_factor_id::text as mfa_factor_id, mfa_activated_at
    from public.internal_admins
    where user_id = ${userId}::uuid`
  if (!activation?.mfa_factor_id || !activation.mfa_activated_at) {
    return claims
  }

  const sessionId = randomUUID()
  const challengedAt = new Date(
    new Date(activation.mfa_activated_at).getTime() + 1_000
  )
  await tx`
    insert into auth.sessions
      (id, user_id, created_at, updated_at, factor_id, aal)
    values (
      ${sessionId}::uuid,
      ${userId}::uuid,
      ${challengedAt},
      ${challengedAt},
      ${activation.mfa_factor_id}::uuid,
      'aal2'::auth.aal_level
    )`
  await tx`
    insert into auth.mfa_amr_claims
      (id, session_id, created_at, updated_at, authentication_method)
    values (
      ${randomUUID()}::uuid,
      ${sessionId}::uuid,
      ${challengedAt},
      ${challengedAt},
      'totp'
    )`

  return {
    ...claims,
    session_id: sessionId,
    amr: [
      {
        method: "totp",
        timestamp: Math.floor(challengedAt.getTime() / 1_000),
      },
    ],
  }
}

async function isInternalAdmin(sp) {
  const rows = await sp`select public.is_internal_admin() as allowed`
  return rows[0]?.allowed ?? null
}
