import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js"

/**
 * QA BUG-061 (38c42a1..2c45031): /demo is prerendered at build time, but it
 * sat inside the Proxy matcher. On a full load of a production build the Proxy
 * attached a per-request nonce CSP that the build-time HTML could not carry,
 * so the inline RSC scripts were blocked and the demo card never hydrated. The
 * same response minted a device cookie beside `s-maxage=31536000`.
 *
 * Static brochure pages must stay outside the matcher so the fixed CSP from
 * next.config.ts applies. This asks Next's own matcher, using the real
 * exported `config`, rather than pattern-matching the source.
 */

async function loadProxyConfig() {
  const result = await build({
    stdin: {
      contents: `export { config } from "./proxy.ts"`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    banner: {
      js: `import { createRequire as __cr } from "node:module"; const require = __cr(${JSON.stringify(`${process.cwd()}/proxy.ts`)}); const __dirname = ${JSON.stringify(process.cwd())}; const __filename = ${JSON.stringify(`${process.cwd()}/proxy.ts`)};`,
    },
  })
  const loaded = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  )
  return loaded.config
}

const config = await loadProxyConfig()

function proxyRuns(url) {
  return unstable_doesMiddlewareMatch({
    config,
    url: `https://nabaperks.test${url}`,
  })
}

test("the prerendered live demo is served outside the Proxy (QA BUG-061)", () => {
  for (const url of ["/demo", "/demo/", "/demo?from=qr"]) {
    assert.equal(proxyRuns(url), false, url)
  }
})

test("cacheable brochure pages stay outside the Proxy", () => {
  for (const url of [
    "/",
    "/pricing",
    "/about",
    "/faq",
    "/how-it-works",
    "/privacy",
    "/terms",
    "/cookies",
    "/data-processing",
    "/merchant-terms",
    "/loyalty-for-pubs",
    "/loyalty-for-bars",
    "/loyalty-for-cafes",
    "/loyalty-for-takeaways",
    "/guides/paper-vs-qr-loyalty-for-pubs",
  ]) {
    assert.equal(proxyRuns(url), false, url)
  }
})

test("stateful surfaces still run through the Proxy", () => {
  for (const url of [
    "/home",
    "/home/login",
    "/app",
    "/app/launch",
    "/login",
    "/card/abc",
    "/api/health",
    "/start/venue",
    "/reward/abc",
  ]) {
    assert.equal(proxyRuns(url), true, url)
  }
})
