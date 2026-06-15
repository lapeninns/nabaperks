import { describe, expect, it } from "vitest"

import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  it("returns 200 with a structured, uncacheable liveness payload", async () => {
    const res = await GET(new Request("http://localhost/api/health"))

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("no-store")

    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(typeof body.service).toBe("string")
    expect(typeof body.version).toBe("string")
    expect(typeof body.uptime).toBe("number")
    expect(typeof body.time).toBe("string")
  })

  it("echoes the request id when one is supplied", async () => {
    const res = await GET(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": "trace-health-1" },
      })
    )

    expect(res.headers.get("x-request-id")).toBe("trace-health-1")
  })
})
