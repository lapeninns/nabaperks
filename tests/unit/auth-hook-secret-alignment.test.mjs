import assert from "node:assert/strict"
import { test } from "node:test"

import { checkAuthHookSecretAlignment } from "../../scripts/check-auth-hook-secret-alignment.mjs"

const SECRET = `v1,whsec_${Buffer.alloc(32, 0x41).toString("base64")}`

test("alignment accepts the protected secret and rejects an alternate signature", async () => {
  const requests = []
  await checkAuthHookSecretAlignment({
    origin: "https://staged.example.test",
    secret: SECRET,
    fetchImpl: async (url, init) => {
      requests.push({ url: url.href, init })
      return new Response(null, { status: requests.length === 1 ? 400 : 401 })
    },
    now: 1_788_400_000_000,
  })

  assert.equal(requests.length, 2)
  assert.equal(
    requests[0].url,
    "https://staged.example.test/api/auth/hooks/send-email"
  )
  assert.equal(requests[0].init.body, "{")
  assert.notEqual(
    requests[0].init.headers["webhook-signature"],
    requests[1].init.headers["webhook-signature"]
  )
})

test("alignment fails closed when the protected secret is rejected", async () => {
  await assert.rejects(
    checkAuthHookSecretAlignment({
      origin: "https://staged.example.test",
      secret: SECRET,
      fetchImpl: async () => new Response(null, { status: 401 }),
    }),
    /did not accept/
  )
})

test("alignment fails closed when an alternate secret is accepted", async () => {
  let requestCount = 0
  await assert.rejects(
    checkAuthHookSecretAlignment({
      origin: "https://staged.example.test",
      secret: SECRET,
      fetchImpl: async () => {
        requestCount += 1
        return new Response(null, { status: 400 })
      },
    }),
    /did not reject/
  )
  assert.equal(requestCount, 2)
})

test("alignment rejects non-HTTPS and short-secret inputs before network use", async () => {
  let requests = 0
  const fetchImpl = async () => {
    requests += 1
    return new Response(null, { status: 400 })
  }

  await assert.rejects(
    checkAuthHookSecretAlignment({
      origin: "http://staged.example.test",
      secret: SECRET,
      fetchImpl,
    }),
    /valid HTTPS origin/
  )
  await assert.rejects(
    checkAuthHookSecretAlignment({
      origin: "https://staged.example.test",
      secret: "v1,whsec_c2hvcnQ=",
      fetchImpl,
    }),
    /not a valid protected hook secret/
  )
  assert.equal(requests, 0)
})
