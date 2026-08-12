import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { registerHooks } from "node:module"
import { promisify } from "node:util"
import { mock, test } from "node:test"

const fixtureMode = process.env.TASK12_ANALYTICS_FIXTURE === "1"

if (fixtureMode) {
  await runFixture()
} else {
  const execFileAsync = promisify(execFile)

  for (const routeName of ["funnel", "web-vitals"]) {
    for (const scenario of ["timeout", "transport"]) {
      test(`Given the ${routeName} body reader reports ${scenario} When the actual POST handler responds Then it fails safely without a 500 or private detail`, async () => {
        const { stdout } = await execFileAsync(
          process.execPath,
          [
            "--experimental-test-module-mocks",
            "--import",
            "./tests/support/register-alias.mjs",
            import.meta.filename,
            routeName,
            scenario,
          ],
          {
            env: { ...process.env, TASK12_ANALYTICS_FIXTURE: "1" },
            timeout: 5_000,
          }
        )
        const result = JSON.parse(stdout)

        assert.equal(result.status, 400)
        assert.deepEqual(result.body, { error: "invalid_request" })
        assert.equal(result.privateDetailPresent, false)
      })
    }
  }
}

async function runFixture() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(
        specifier === "next/server" ? "next/server.js" : specifier,
        context
      )
    },
  })

  const routeName = process.argv[2]
  const scenario = process.argv[3]
  const { NextRequest } = await import("next/server.js")
  const boundedRequest = await import("@/lib/http/bounded-json-request")

  mock.module("@/lib/http/bounded-json-request", {
    namedExports: {
      ...boundedRequest,
      readBoundedRequestBody: async (request, maxBytes) => {
        const readerError = request.headers.get("x-task12-reader-error")
        if (readerError === "timeout") {
          throw new boundedRequest.RequestBodyTimeoutError(20)
        }
        if (readerError === "transport") {
          throw new boundedRequest.RequestBodyTransportError(
            new Error("synthetic-private-body@example.test")
          )
        }
        return boundedRequest.readBoundedRequestBody(request, maxBytes)
      },
    },
  })
  mock.module("@/lib/security/rate-limit", {
    namedExports: {
      RateLimitError: class RateLimitError extends Error {},
      enforceRateLimit: async () => undefined,
      trustedClientIp: () => "127.0.0.1",
    },
  })
  mock.module("@/lib/analytics/funnel-events", {
    namedExports: {
      recordAnonymousFunnelEvent: async () => ({ token: "opaque-token" }),
    },
  })
  mock.module("@/lib/analytics/web-vitals", {
    namedExports: { recordWebVitalSample: async () => undefined },
  })

  const route = await import(
    routeName === "funnel"
      ? "@/app/api/analytics/funnel/route"
      : "@/app/api/analytics/web-vitals/route"
  )
  const path = `/api/analytics/${routeName}`
  const request = new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-task12-reader-error": scenario,
    },
    body: "{}",
  })
  const response = await route.POST(request)
  const body = await response.text()

  process.stdout.write(
    JSON.stringify({
      status: response.status,
      body: JSON.parse(body),
      privateDetailPresent: /synthetic-private-body@example\.test/.test(body),
    })
  )
}
