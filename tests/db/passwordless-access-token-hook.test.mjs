import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

async function invokeHook(tx, event) {
  const [row] = await tx`
    select public.reject_password_access_tokens(
      ${tx.json(event)}::jsonb
    ) as result`
  return row.result
}

test(
  "password authentication is rejected before an access token is issued",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const result = await invokeHook(tx, {
        authentication_method: "password",
        claims: {
          sub: "00000000-0000-0000-0000-000000000001",
          amr: [{ method: "password", timestamp: 1 }],
        },
      })

      assert.equal(result.error?.http_code, 403)
      assert.match(
        result.error?.message ?? "",
        /password authentication is disabled/i
      )
      assert.equal(result.claims, undefined)
    })
  }
)

test(
  "refresh and MFA cannot launder a password-origin session",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const result = await invokeHook(tx, {
        authentication_method: "token_refresh",
        claims: {
          sub: "00000000-0000-0000-0000-000000000001",
          amr: [
            { method: "password", timestamp: 1 },
            { method: "totp", timestamp: 2 },
          ],
        },
      })

      assert.equal(result.error?.http_code, 403)
      assert.equal(result.claims, undefined)
    })
  }
)

test(
  "email OTP and TOTP-only claims pass through unchanged",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const claims = {
        sub: "00000000-0000-0000-0000-000000000001",
        role: "authenticated",
        amr: [
          { method: "otp", timestamp: 1 },
          { method: "totp", timestamp: 2 },
        ],
      }
      const result = await invokeHook(tx, {
        authentication_method: "otp",
        claims,
      })

      assert.deepEqual(result, { claims })
    })
  }
)

test(
  "missing, empty, malformed and unknown AMR cannot mint authority",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      for (const claims of [
        { sub: "00000000-0000-0000-0000-000000000001" },
        { sub: "00000000-0000-0000-0000-000000000001", amr: [] },
        { sub: "00000000-0000-0000-0000-000000000001", amr: "otp" },
        {
          sub: "00000000-0000-0000-0000-000000000001",
          amr: [{ method: "oauth", timestamp: 1 }],
        },
      ]) {
        const result = await invokeHook(tx, {
          authentication_method: "token_refresh",
          claims,
        })

        assert.equal(result.error?.http_code, 403)
        assert.equal(result.claims, undefined)
      }
    })
  }
)

test(
  "only Supabase Auth may invoke the access-token hook",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`
      select
        has_function_privilege(
          'supabase_auth_admin',
          'public.reject_password_access_tokens(jsonb)',
          'execute'
        ) as auth_admin,
        has_function_privilege(
          'service_role',
          'public.reject_password_access_tokens(jsonb)',
          'execute'
        ) as service_role,
        has_function_privilege(
          'authenticated',
          'public.reject_password_access_tokens(jsonb)',
          'execute'
        ) as authenticated,
        has_function_privilege(
          'anon',
          'public.reject_password_access_tokens(jsonb)',
          'execute'
        ) as anon,
        has_function_privilege(
          'public',
          'public.reject_password_access_tokens(jsonb)',
          'execute'
        ) as public`

      assert.deepEqual(row, {
        auth_admin: true,
        service_role: false,
        authenticated: false,
        anon: false,
        public: false,
      })
    })
  }
)

test(
  "request-time authority rejects legacy password JWTs during rollout",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await setClaims(tx, {
        role: "authenticated",
        amr: [
          { method: "password", timestamp: 1 },
          { method: "totp", timestamp: 2 },
        ],
      })
      const [{ current_auth_session_is_passwordless: passwordOrigin }] =
        await tx`select public.current_auth_session_is_passwordless()`
      assert.equal(passwordOrigin, false)

      await setClaims(tx, {
        role: "authenticated",
        amr: [
          { method: "otp", timestamp: 1 },
          { method: "totp", timestamp: 2 },
        ],
      })
      const [{ current_auth_session_is_passwordless: otpOrigin }] =
        await tx`select public.current_auth_session_is_passwordless()`
      assert.equal(otpOrigin, true)

      await setClaims(tx, { role: "authenticated" })
      const [{ current_auth_session_is_passwordless: missingAmr }] =
        await tx`select public.current_auth_session_is_passwordless()`
      assert.equal(missingAmr, false)

      for (const amr of [[], "otp", [{ method: "oauth", timestamp: 1 }]]) {
        await setClaims(tx, { role: "authenticated", amr })
        const [{ current_auth_session_is_passwordless: unsupportedAmr }] =
          await tx`select public.current_auth_session_is_passwordless()`
        assert.equal(unsupportedAmr, false)
      }
    })
  }
)

test(
  "only authenticated sessions and service checks may call the rollout guard",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`
        select
          has_function_privilege(
            'authenticated',
            'public.current_auth_session_is_passwordless()',
            'execute'
          ) as authenticated,
          has_function_privilege(
            'service_role',
            'public.current_auth_session_is_passwordless()',
            'execute'
          ) as service_role,
          has_function_privilege(
            'anon',
            'public.current_auth_session_is_passwordless()',
            'execute'
          ) as anon,
          has_function_privilege(
            'public',
            'public.current_auth_session_is_passwordless()',
            'execute'
          ) as public`

      assert.deepEqual(row, {
        authenticated: true,
        service_role: true,
        anon: false,
        public: false,
      })
    })
  }
)

test(
  "the Data API pre-request guard rejects legacy password JWTs",
  { skip },
  async () => {
    await assert.rejects(
      inRolledBackTxn(async (tx) => {
        await setClaims(tx, {
          role: "authenticated",
          amr: [{ method: "password", timestamp: 1 }],
        })
        await tx`select private.enforce_passwordless_data_api_session()`
      }),
      /passwordless authentication session is required/i
    )

    await inRolledBackTxn(async (tx) => {
      await setClaims(tx, {
        role: "authenticated",
        amr: [{ method: "otp", timestamp: 1 }],
      })
      await tx`select private.enforce_passwordless_data_api_session()`
    })
  }
)

test(
  "the Data API release probe proves the loaded guard without authority",
  { skip },
  async () => {
    await assert.rejects(
      inRolledBackTxn(async (tx) => {
        await tx`select set_config(
          'request.headers',
          ${JSON.stringify({
            "x-nabaperks-passwordless-guard-probe": "active",
          })},
          true
        )`
        await tx`select private.enforce_passwordless_data_api_session()`
      }),
      /passwordless data api guard is active/i
    )
  }
)

test(
  "the release-owned pre-request guard has exact callable privileges",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [row] = await tx`
        select
          has_function_privilege(
            'authenticated',
            'private.enforce_passwordless_data_api_session()',
            'execute'
          ) as authenticated,
          has_function_privilege(
            'anon',
            'private.enforce_passwordless_data_api_session()',
            'execute'
          ) as anon,
          has_function_privilege(
            'service_role',
            'private.enforce_passwordless_data_api_session()',
            'execute'
          ) as service_role,
          has_function_privilege(
            'public',
            'private.enforce_passwordless_data_api_session()',
            'execute'
          ) as public`

      assert.deepEqual(row, {
        authenticated: true,
        anon: true,
        service_role: true,
        public: false,
      })
    })
  }
)

async function setClaims(tx, claims) {
  await tx`select set_config(
    'request.jwt.claim.role',
    ${claims.role ?? ""},
    true
  )`
  await tx`select set_config(
    'request.jwt.claims',
    ${JSON.stringify(claims)},
    true
  )`
}
