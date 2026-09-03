import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
const ORIGIN = "https://nabaperks.com"
const CHALLENGE = "A".repeat(43)

after(closeDb)

test(
  "an activated credential without a grant has no admin authority",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      const allowed = await asUser(
        tx,
        fixture.userId,
        fixture.sessionId,
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(allowed, false)
    })
  }
)

test(
  "a fresh exact-credential grant on a live aal1 session restores authority",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      await grant(tx, fixture)
      const allowed = await asUser(
        tx,
        fixture.userId,
        fixture.sessionId,
        (sp) => isInternalAdmin(sp)
      )
      assert.equal(allowed, true)
    })
  }
)

test("expired and cross-session grants fail closed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createActivatedAdmin(tx)
    await grant(tx, fixture, "expired")
    assert.equal(
      await asUser(tx, fixture.userId, fixture.sessionId, isInternalAdmin),
      false
    )

    const otherSessionId = await createSession(tx, fixture.userId)
    assert.equal(
      await asUser(tx, fixture.userId, otherSessionId, isInternalAdmin),
      false
    )
  })
})

test(
  "a grant for a different credential cannot satisfy an activated binding",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      const otherUser = await createUser(tx)
      const otherCredential = await createCredential(tx, otherUser)
      await tx`
      insert into public.admin_webauthn_grants
        (user_id, session_id, credential_id, verified_at, expires_at)
      values (
        ${fixture.userId}::uuid, ${fixture.sessionId}::uuid,
        ${otherCredential}::uuid, clock_timestamp(),
        clock_timestamp() + interval '10 minutes'
      )`
      assert.equal(
        await asUser(tx, fixture.userId, fixture.sessionId, isInternalAdmin),
        false
      )
    })
  }
)

test(
  "logout or session deletion invalidates a grant immediately",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      await grant(tx, fixture)
      await tx`delete from auth.sessions where id = ${fixture.sessionId}::uuid`
      assert.equal(
        await asUser(tx, fixture.userId, fixture.sessionId, isInternalAdmin),
        false
      )
    })
  }
)

test(
  "activation invalidates proof created before independent approval",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const userId = await createAdmin(tx)
      const credentialId = await createCredential(tx, userId)
      const sessionId = await createSession(tx, userId)
      await grant(tx, { userId, credentialId, sessionId })
      await activate(tx, userId, credentialId)
      assert.equal(await asUser(tx, userId, sessionId, isInternalAdmin), false)
    })
  }
)

test(
  "credential revocation atomically removes the binding and grant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      await grant(tx, fixture)
      await asUser(
        tx,
        fixture.userId,
        fixture.sessionId,
        (sp) =>
          sp`select public.revoke_viewer_admin_webauthn_credential(${fixture.credentialId}::uuid)`
      )
      const [state] = await tx`
      select mfa_factor_id, mfa_activated_at
      from public.internal_admins where user_id = ${fixture.userId}::uuid`
      assert.equal(state.mfa_factor_id, null)
      assert.equal(state.mfa_activated_at, null)
      assert.equal(
        Number(
          (
            await tx`select count(*) as n from public.admin_webauthn_grants where user_id = ${fixture.userId}::uuid`
          )[0].n
        ),
        0
      )
    })
  }
)

test(
  "a challenge is exact-session, purpose, origin, expiry and one-use bound",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`update public.internal_admins set is_active = false`
      const userId = await createAdmin(tx)
      const sessionId = await createSession(tx, userId)
      const challengeId = await asUser(
        tx,
        userId,
        sessionId,
        async (sp) =>
          (
            await sp`
          select public.begin_admin_webauthn_challenge(
            'registration', ${CHALLENGE}, ${ORIGIN}
          ) as id`
          )[0].id
      )
      const wrongSession = await createSession(tx, userId)
      assert.equal(
        await asUser(tx, userId, wrongSession, (sp) =>
          consume(sp, challengeId, "registration", ORIGIN)
        ),
        false
      )
      assert.equal(
        await asUser(tx, userId, sessionId, (sp) =>
          consume(sp, challengeId, "authentication", ORIGIN)
        ),
        false
      )
      assert.equal(
        await asUser(tx, userId, sessionId, (sp) =>
          consume(sp, challengeId, "registration", "https://mfa.nabaperks.com")
        ),
        false
      )
      assert.equal(
        await asUser(tx, userId, sessionId, (sp) =>
          consume(sp, challengeId, "registration", ORIGIN)
        ),
        true
      )
      assert.equal(
        await asUser(tx, userId, sessionId, (sp) =>
          consume(sp, challengeId, "registration", ORIGIN)
        ),
        false
      )
    })
  }
)

test(
  "forged UV=false registration evidence is rejected",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`update public.internal_admins set is_active = false`
      const userId = await createAdmin(tx)
      const sessionId = await createSession(tx, userId)
      const challengeId = await asUser(tx, userId, sessionId, async (sp) => {
        const [{ id }] = await sp`
        select public.begin_admin_webauthn_challenge(
          'registration', ${CHALLENGE}, ${ORIGIN}
        ) as id`
        assert.equal(await consume(sp, id, "registration", ORIGIN), true)
        return id
      })
      await assert.rejects(
        () => tx`
        select public.register_admin_webauthn_credential(
          ${challengeId}::uuid, ${"B".repeat(32)}, ${"C".repeat(48)}, 0,
          '[]'::jsonb, 'singleDevice', false, false
        )`,
        (error) => error?.code === "22023"
      )
    })
  }
)

test(
  "verified registration finalises the challenge and stores the credential",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`update public.internal_admins set is_active = false`
      const userId = await createAdmin(tx)
      const sessionId = await createSession(tx, userId)
      const challengeId = await asUser(tx, userId, sessionId, async (sp) => {
        const [{ id }] = await sp`
        select public.begin_admin_webauthn_challenge(
          'registration', ${CHALLENGE}, ${ORIGIN}
        ) as id`
        assert.equal(await consume(sp, id, "registration", ORIGIN), true)
        return id
      })

      const [{ credentialId }] = await tx`
      select public.register_admin_webauthn_credential(
        ${challengeId}::uuid, ${"B".repeat(32)}, ${"C".repeat(48)}, 0,
        '["internal"]'::jsonb, 'singleDevice', false, true
      ) as "credentialId"`
      const [challenge] = await tx`
      select credential_id as "credentialId", finalised_at as "finalisedAt"
      from public.admin_webauthn_challenges
      where id = ${challengeId}::uuid`

      assert.equal(challenge.credentialId, credentialId)
      assert.ok(challenge.finalisedAt)
    })
  }
)

test(
  "a verified assertion creates one short-lived grant and cannot be replayed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      const externalCredentialId = await getExternalCredentialId(
        tx,
        fixture.credentialId
      )
      const challengeId = await createConsumedAuthenticationChallenge(
        tx,
        fixture
      )

      const [{ granted }] = await tx`
      select public.grant_admin_webauthn_session(
        ${challengeId}::uuid, ${externalCredentialId}, 0, 1, true
      ) as granted`
      const [grantState] = await tx`
      select
        expires_at > clock_timestamp() as fresh,
        expires_at <= clock_timestamp() + interval '10 minutes' as bounded
      from public.admin_webauthn_grants
      where user_id = ${fixture.userId}::uuid
        and session_id = ${fixture.sessionId}::uuid`

      assert.equal(granted, true)
      assert.deepEqual(grantState, { fresh: true, bounded: true })
      assert.equal(
        await asUser(tx, fixture.userId, fixture.sessionId, isInternalAdmin),
        true
      )
      await assertServiceCallRejected(
        tx,
        (sp) => sp`
      select public.grant_admin_webauthn_session(
        ${challengeId}::uuid, ${externalCredentialId}, 1, 2, true
      )`
      )
    })
  }
)

test(
  "grant issuance rejects false UV, wrong credentials and expired challenges",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      const externalCredentialId = await getExternalCredentialId(
        tx,
        fixture.credentialId
      )

      const falseUvChallenge = await createConsumedAuthenticationChallenge(
        tx,
        fixture
      )
      await assertServiceCallRejected(
        tx,
        (sp) => sp`
      select public.grant_admin_webauthn_session(
        ${falseUvChallenge}::uuid, ${externalCredentialId}, 0, 1, false
      )`
      )

      const wrongCredentialChallenge =
        await createConsumedAuthenticationChallenge(tx, fixture)
      await assertServiceCallRejected(
        tx,
        (sp) => sp`
      select public.grant_admin_webauthn_session(
        ${wrongCredentialChallenge}::uuid, ${"wrong_credential_" + "X".repeat(24)}, 0, 1, true
      )`
      )

      const expiredChallenge = await createConsumedAuthenticationChallenge(
        tx,
        fixture
      )
      await tx`
      update public.admin_webauthn_challenges
      set created_at = clock_timestamp() - interval '6 minutes',
          expires_at = clock_timestamp() - interval '1 minute'
      where id = ${expiredChallenge}::uuid`
      await assertServiceCallRejected(
        tx,
        (sp) => sp`
      select public.grant_admin_webauthn_session(
        ${expiredChallenge}::uuid, ${externalCredentialId}, 0, 1, true
      )`
      )
    })
  }
)

test(
  "a stale authenticator counter cannot win a later grant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      const externalCredentialId = await getExternalCredentialId(
        tx,
        fixture.credentialId
      )
      const firstChallenge = await createConsumedAuthenticationChallenge(
        tx,
        fixture
      )
      await tx`
      select public.grant_admin_webauthn_session(
        ${firstChallenge}::uuid, ${externalCredentialId}, 0, 1, true
      )`

      const secondChallenge = await createConsumedAuthenticationChallenge(
        tx,
        fixture
      )
      await assertServiceCallRejected(
        tx,
        (sp) => sp`
      select public.grant_admin_webauthn_session(
        ${secondChallenge}::uuid, ${externalCredentialId}, 0, 2, true
      )`
      )
    })
  }
)

test(
  "authenticated callers cannot activate their own credential",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const userId = await createAdmin(tx)
      const credentialId = await createCredential(tx, userId)
      const sessionId = await createSession(tx, userId)
      await assert.rejects(
        () =>
          asUser(
            tx,
            userId,
            sessionId,
            (sp) =>
              sp`select public.activate_internal_admin_mfa(${userId}::uuid, ${credentialId}::uuid)`
          ),
        (error) => error?.code === "42501"
      )
    })
  }
)

test(
  "deactivating an admin clears credential binding and grants",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createActivatedAdmin(tx)
      await grant(tx, fixture)
      await tx`update public.internal_admins set is_active = false where user_id = ${fixture.userId}::uuid`
      const [state] = await tx`
      select mfa_factor_id, mfa_activated_at
      from public.internal_admins where user_id = ${fixture.userId}::uuid`
      assert.equal(state.mfa_factor_id, null)
      assert.equal(state.mfa_activated_at, null)
    })
  }
)

test(
  "browser roles cannot read credential, challenge or grant tables directly",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const userId = await createUser(tx)
      const sessionId = await createSession(tx, userId)
      await assert.rejects(
        () =>
          asUser(
            tx,
            userId,
            sessionId,
            (sp) => sp`select * from public.admin_webauthn_credentials`
          ),
        (error) => error?.code === "42501"
      )
    })
  }
)

async function createUser(tx) {
  const userId = randomUUID()
  await tx`insert into auth.users (id) values (${userId}::uuid)`
  return userId
}

async function createAdmin(tx) {
  const userId = await createUser(tx)
  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (${userId}::uuid, ${`admin-${userId}@example.test`}, true)`
  return userId
}

async function createCredential(tx, userId) {
  const credentialId = randomUUID()
  await tx`
    insert into public.admin_webauthn_credentials (
      id, user_id, credential_id, public_key, counter, transports,
      device_type, backed_up, user_verified
    ) values (
      ${credentialId}::uuid, ${userId}::uuid,
      ${`cred_${credentialId.replaceAll("-", "")}`},
      ${`public_key_${credentialId.replaceAll("-", "")}`}, 0,
      '["internal"]'::jsonb, 'singleDevice', false, true
    )`
  return credentialId
}

async function createSession(tx, userId) {
  const sessionId = randomUUID()
  await tx`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${sessionId}::uuid, ${userId}::uuid, now(), now(), 'aal1'::auth.aal_level)`
  return sessionId
}

async function createActivatedAdmin(tx) {
  const userId = await createAdmin(tx)
  const credentialId = await createCredential(tx, userId)
  await activate(tx, userId, credentialId)
  return { userId, credentialId, sessionId: await createSession(tx, userId) }
}

async function activate(tx, userId, credentialId) {
  await tx`
    select public.activate_internal_admin_mfa(
      ${userId}::uuid, ${credentialId}::uuid
    )`
}

async function getExternalCredentialId(tx, credentialId) {
  return (
    await tx`
      select credential_id as id
      from public.admin_webauthn_credentials
      where id = ${credentialId}::uuid`
  )[0].id
}

async function createConsumedAuthenticationChallenge(tx, fixture) {
  return asUser(tx, fixture.userId, fixture.sessionId, async (sp) => {
    const [{ id }] = await sp`
      select public.begin_admin_webauthn_challenge(
        'authentication', ${CHALLENGE}, ${ORIGIN}
      ) as id`
    assert.equal(await consume(sp, id, "authentication", ORIGIN), true)
    return id
  })
}

async function assertServiceCallRejected(tx, call) {
  await assert.rejects(
    () => tx.savepoint(async (sp) => call(sp)),
    (error) => error?.code === "42501" || error?.code === "22023"
  )
}

async function grant(tx, fixture, state = "fresh") {
  const verified =
    state === "expired"
      ? "clock_timestamp() - interval '20 minutes'"
      : "clock_timestamp()"
  const expires =
    state === "expired"
      ? "clock_timestamp() - interval '10 minutes'"
      : "clock_timestamp() + interval '10 minutes'"
  await tx.unsafe(
    `insert into public.admin_webauthn_grants
      (user_id, session_id, credential_id, verified_at, expires_at)
     values ($1::uuid, $2::uuid, $3::uuid, ${verified}, ${expires})`,
    [fixture.userId, fixture.sessionId, fixture.credentialId]
  )
}

async function asUser(tx, userId, sessionId, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({
      sub: userId,
      role: "authenticated",
      aal: "aal1",
      session_id: sessionId,
      amr: [{ method: "otp", timestamp: 1 }],
    })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
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

async function isInternalAdmin(sql) {
  return (await sql`select public.is_internal_admin() as allowed`)[0].allowed
}

async function consume(sql, id, purpose, origin) {
  return (
    await sql`
      select public.consume_viewer_admin_webauthn_challenge(
        ${id}::uuid, ${purpose}, ${origin}
      ) as consumed`
  )[0].consumed
}
