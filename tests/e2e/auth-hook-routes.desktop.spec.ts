import { createHmac, randomUUID } from "node:crypto"

import { expect, test, type APIRequestContext } from "@playwright/test"

const AUTH_HOOK_SECRET = `v1,${"whsec"}_${"dGVzdC1ob29rLXNlY3JldA=="}`

type HookPath = "/api/auth/hooks/send-email" | "/api/auth/hooks/send-sms"

function signedHeaders(body: string) {
  const webhookId = "msg_test_auth_hook"
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const key = Buffer.from(
    AUTH_HOOK_SECRET.replace(/^v1,/, "").replace(/^whsec_/, ""),
    "base64"
  )
  const signature = createHmac("sha256", key)
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64")

  return {
    "content-type": "application/json",
    "webhook-id": webhookId,
    "webhook-signature": `v1,${signature}`,
    "webhook-timestamp": timestamp,
  }
}

async function postHook({
  body,
  path,
  request,
}: {
  readonly body: string
  readonly path: HookPath
  readonly request: APIRequestContext
}) {
  return request.post(path, {
    data: Buffer.from(body),
    headers: signedHeaders(body),
  })
}

test.describe("Supabase auth hook routes", () => {
  test("invalid email hook signatures are rejected before payload handling", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/hooks/send-email", {
      data: Buffer.from("{}"),
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_test_auth_hook",
        "webhook-signature": "v1,not-a-valid-signature",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
      },
    })

    expect(response.status()).toBe(401)
    await expect(response.text()).resolves.toContain("Invalid signature.")
  })

  test("signed malformed email hook payloads fail closed before Resend", async ({
    request,
  }) => {
    const response = await postHook({
      body: "{",
      path: "/api/auth/hooks/send-email",
      request,
    })

    test.skip(
      response.status() === 401,
      "existing dev server is not using the Playwright test hook secret"
    )
    expect(response.status()).toBe(400)
    await expect(response.text()).resolves.toContain("Malformed payload.")
  })

  test("signed unsupported email actions fail before alias or provider work", async ({
    request,
  }) => {
    const response = await postHook({
      body: JSON.stringify({
        user: { email: "venue@example.test", id: randomUUID() },
        email_data: { token: "provider-token", email_action_type: "invite" },
      }),
      path: "/api/auth/hooks/send-email",
      request,
    })

    test.skip(
      response.status() === 401,
      "existing dev server is not using the Playwright test hook secret"
    )
    expect(response.status()).toBe(400)
    await expect(response.text()).resolves.toContain(
      "Unsupported email action."
    )
  })

  test("signed signup actions require an authoritative user identity", async ({
    request,
  }) => {
    const response = await postHook({
      body: JSON.stringify({
        user: { email: "venue@example.test" },
        email_data: { token: "provider-token", email_action_type: "signup" },
      }),
      path: "/api/auth/hooks/send-email",
      request,
    })

    test.skip(
      response.status() === 401,
      "existing dev server is not using the Playwright test hook secret"
    )
    expect(response.status()).toBe(400)
    await expect(response.text()).resolves.toContain(
      "Missing signup user identity."
    )
  })

  test("signed signup actions reject malformed user identities", async ({
    request,
  }) => {
    const response = await postHook({
      body: JSON.stringify({
        user: { email: "venue@example.test", id: "not-a-user-id" },
        email_data: { token: "provider-token", email_action_type: "signup" },
      }),
      path: "/api/auth/hooks/send-email",
      request,
    })

    test.skip(
      response.status() === 401,
      "existing dev server is not using the Playwright test hook secret"
    )
    expect(response.status()).toBe(400)
    await expect(response.text()).resolves.toContain(
      "Missing signup user identity."
    )
  })

  test("signed malformed SMS hook payloads fail closed before Twilio", async ({
    request,
  }) => {
    const response = await postHook({
      body: "{",
      path: "/api/auth/hooks/send-sms",
      request,
    })

    test.skip(
      response.status() === 401,
      "existing dev server is not using the Playwright test hook secret"
    )
    expect(response.status()).toBe(400)
    await expect(response.text()).resolves.toContain("Malformed payload.")
  })
})
