import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import { registerHooks } from "node:module"

import { NextRequest } from "next/server.js"

import { isSameOriginRequest } from "@/lib/http/bounded-json-request"

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/server" ? "next/server.js" : specifier,
      context
    )
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".json")) return nextLoad(url, context)
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${readFileSync(new URL(url), "utf8")}`,
    }
  },
})

const { proxy } = await import("@/proxy")

delete process.env.VERCEL

async function evaluateOrigin(request) {
  const host = request.headers.host
  if (!host) return false

  const url = `http://${host}/api/health`
  const proxyResponse = await proxy(
    new NextRequest(url, { headers: new Headers(request.headers) })
  )
  const names = proxyResponse.headers
    .get("x-middleware-override-headers")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (!names) return false

  const downstreamHeaders = new Headers()
  for (const name of names) {
    const value = proxyResponse.headers.get(`x-middleware-request-${name}`)
    if (value !== null) downstreamHeaders.set(name, value)
  }

  return isSameOriginRequest(
    new NextRequest(url, { headers: downstreamHeaders })
  )
}

const server = createServer(async (request, response) => {
  if (request.url === "/abort") {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  const sameOrigin = await evaluateOrigin(request)
  response.writeHead(sameOrigin ? 204 : 403, { "content-length": "0" })
  response.end()
})

server.requestTimeout = 2_000
server.headersTimeout = 2_000

server.listen(0, "127.0.0.1", () => {
  const address = server.address()
  if (!address || typeof address === "string") {
    process.exitCode = 1
    server.close()
    return
  }
  process.stdout.write(
    `FIXTURE_PID=${process.pid} FIXTURE_PORT=${address.port}\n`
  )
})

process.on("SIGTERM", () => {
  server.close(() => {
    process.stdout.write("FIXTURE_STOPPED\n")
  })
})
