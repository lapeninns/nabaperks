import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8"
)

for (const stylesheet of [
  "/_next/static/css/app/layout.css?v=123",
  "/_next/static/chunks/app_0gmxqvz._.css",
]) {
  test(`offline shell captures styles and fonts from ${stylesheet}`, async () => {
    const captured = []
    const font = "/_next/static/media/brand.woff2"
    const script = "/_next/static/chunks/app.js"
    const html = `<link rel="stylesheet" href="${stylesheet}"><link rel="preload" href="${stylesheet}"><script src="${script}"></script>`
    const cache = {
      addAll: async () => {},
      put: async () => {},
      add: async (path) => {
        captured.push(path)
      },
      match: async (path) =>
        path === stylesheet
          ? new Response(`@font-face { src: url("${font}"); }`)
          : undefined,
    }
    const runtime = {
      self: { addEventListener() {} },
      fetch: async () => new Response(html),
      cache,
    }
    runInNewContext(source, runtime)
    await runInNewContext("cacheOfflineShell(cache)", runtime)
    assert.deepEqual(captured, [stylesheet, font])
    assert.ok(!captured.includes(script))
  })
}
