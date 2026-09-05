import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import http from "node:http"
import https from "node:https"

// An isolated release build keeps its production CSP. Terminate throwaway TLS
// on loopback so WebKit can follow upgrade-insecure-requests without weakening
// any application security headers. This never binds to a public interface.
const [keyPath, certPath, portText, upstreamPortText] = process.argv.slice(2)
const port = Number(portText)
const upstreamPort = Number(upstreamPortText)
for (const value of [port, upstreamPort]) {
  assert.ok(Number.isInteger(value) && value > 1024 && value < 65536)
}
assert.notEqual(port, upstreamPort)
assert.ok(
  keyPath && certPath,
  "A local throwaway key and certificate are required"
)

https
  .createServer(
    {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    },
    (request, response) => {
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: upstreamPort,
          path: request.url,
          method: request.method,
          headers: { ...request.headers, "x-forwarded-proto": "https" },
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers)
          result.pipe(response)
        }
      )
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502)
        response.end("Loopback application unavailable")
      })
      request.pipe(upstream)
    }
  )
  .listen(port, "127.0.0.1", () => {
    console.log(`Loopback HTTPS ready on port ${port}`)
  })
