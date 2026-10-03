import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

const result = await build({
  stdin: {
    contents:
      'export { proxy } from "./proxy.ts"; export { NextRequest } from "next/server";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
  banner: {
    js: `import { createRequire } from "node:module"; const require = createRequire(${JSON.stringify(`${process.cwd()}/proxy.ts`)}); const __dirname = ${JSON.stringify(process.cwd())}; const __filename = ${JSON.stringify(`${process.cwd()}/proxy.ts`)};`,
  },
  plugins: [
    {
      name: "poster-proxy-auth-boundary",
      setup(build) {
        build.onResolve(
          { filter: /^@\/lib\/supabase\/update-session$/ },
          () => ({
            path: "auth-refresh",
            namespace: "fixture",
          })
        )
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            "export async function refreshSupabaseSession(request, createResponse) { return createResponse() }",
        }))
      },
    },
  ],
})
const { proxy, NextRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
)

test("Given an invalid poster template When proxy permits route rendering Then the response status is 404 before streaming begins", async () => {
  const request = new NextRequest(
    "http://127.0.0.1:3000/app/qr/poster/not-a-template?qr=owned-qr"
  )

  const response = await proxy(request)

  assert.equal(response.status, 404)
  assert.equal(response.headers.get("x-middleware-next"), "1")
  assert.ok(response.headers.get("content-security-policy"))
})

for (const path of [
  "/app/qr/poster/tally?qr=owned-qr",
  "/app/qr/poster/%74ally?qr=owned-qr",
  "/app/qr/poster/%ZZ?qr=owned-qr",
  "/app/qr/tent/not-a-template?qr=owned-qr",
  "/app/qr/poster/not-a-template/other",
  "/app/qr",
]) {
  test(`Given ${path} When proxy permits route rendering Then existing response status is preserved`, async () => {
    const request = new NextRequest(`http://127.0.0.1:3000${path}`)

    const response = await proxy(request)

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("x-middleware-next"), "1")
  })
}
