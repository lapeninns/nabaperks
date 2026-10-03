import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { ftpFixture } from "../support/tooling-ftp-fixture.mjs"

const rootRequire = createRequire(join(process.cwd(), "package.json"))
const lhciRequire = createRequire(rootRequire.resolve("@lhci/cli/package.json"))
const proxyRequire = createRequire(lhciRequire.resolve("proxy-agent"))
const pacRequire = createRequire(proxyRequire.resolve("pac-proxy-agent"))
const getUriPath = pacRequire.resolve("get-uri")
const ftpRequire = createRequire(getUriPath)
const ftpPath = ftpRequire.resolve("basic-ftp")
const { getUri } = await import(pathToFileURL(getUriPath).href)
const shadcnRequire = createRequire(rootRequire.resolve("shadcn"))
const mcpRequire = createRequire(
  shadcnRequire.resolve("@modelcontextprotocol/sdk/server/mcp.js")
)
const { jsx, Suspense, createContext } = mcpRequire("hono/jsx")
const { renderToString, renderToReadableStream } = mcpRequire(
  "hono/jsx/dom/server"
)

test("tooling fixtures resolve the dependency graph inside the current checkout", () => {
  const modulesRoot = `${realpathSync(process.cwd())}/node_modules/`
  for (const path of [
    getUriPath,
    ftpPath,
    mcpRequire.resolve("hono/jsx"),
    mcpRequire.resolve("hono/jsx/dom/server"),
  ]) {
    assert.ok(realpathSync(path).startsWith(modulesRoot), path)
  }
})

async function readFtp(fixture) {
  const stream = await getUri(fixture.url)
  let body = ""
  for await (const chunk of stream) body += chunk.toString()
  assert.equal(body, fixture.payload)
  assert.equal(stream.lastModified.toISOString(), "2026-10-03T09:00:00.000Z")
}

test(
  "LHCI's resolved get-uri downloads FTP content with MDTM metadata",
  { timeout: 10000 },
  async (t) => {
    const fixture = await ftpFixture(t)
    await readFtp(fixture)
    assert.ok(fixture.commands.includes("MDTM"))
    assert.ok(fixture.commands.includes("RETR"))
    assert.equal(fixture.commands.includes("MLSD"), false)
  }
)

test(
  "get-uri retains Client.list() fallback when the server rejects MDTM",
  { timeout: 10000 },
  async (t) => {
    const fixture = await ftpFixture(t, { mdtmFails: true })
    await readFtp(fixture)
    assert.ok(fixture.commands.includes("MLSD"))
    assert.ok(fixture.commands.includes("RETR"))
  }
)

test(
  "get-uri retains same-host PASV downloads when EPSV is unavailable",
  { timeout: 10000 },
  async (t) => {
    const fixture = await ftpFixture(t, { forcePasv: true })
    await readFtp(fixture)
    assert.ok(fixture.commands.includes("PASV"))
    assert.ok(fixture.commands.includes("RETR"))
  }
)

test(
  "get-uri preserves its missing-date error for legacy Unix LIST fallback",
  { timeout: 10000 },
  async (t) => {
    const fixture = await ftpFixture(t, { mdtmFails: true, unixListing: true })
    await assert.rejects(getUri(fixture.url), { code: "ENOTFOUND" })
    assert.ok(fixture.commands.includes("LIST"))
    assert.equal(fixture.commands.includes("RETR"), false)
  }
)

test(
  "FTP listing fallback rejects a PASV host different from its control host",
  { timeout: 10000 },
  async (t) => {
    const fixture = await ftpFixture(t, { mdtmFails: true, separateHost: true })
    await assert.rejects(
      getUri(fixture.url),
      /PASV returned another host \(192\.0\.2\.1\)/
    )
    assert.ok(fixture.commands.includes("PASV"))
    assert.equal(fixture.separateConnections(), 0)
    assert.equal(fixture.commands.includes("RETR"), false)
  }
)

test("Unix FTP listing parser bounds malformed owner/group input and retains ordinary listings", () => {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const assert = require("node:assert/strict")
    const { Client } = require(${JSON.stringify(ftpPath)})
    const client = new Client()
    const malformed = "-rw-r--r-- 1 " + "a ".repeat(65536) + "!"
    const normal = "-rw-r--r-- 1 owner group 42 Jan 1 2020 file.txt"
    const list = client.parseList(malformed + "\\r\\n" + normal + "\\r\\n")
    assert.equal(list.length, 1)
    assert.equal(list[0].name, "file.txt")
    assert.equal(list[0].size, 42)
    client.close()
  `,
    ],
    { encoding: "utf8", timeout: 4000 }
  )
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
})

test("Hono escapes untrusted strings at JSX boundaries and DOM server roots", async () => {
  const unsafe = '<img src="x" onerror="alert(1)">'
  const escaped = "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;"
  const context = createContext(null)
  assert.equal(renderToString(unsafe), escaped)
  assert.equal(String(await jsx(Suspense, {}, unsafe).toString()), escaped)
  assert.equal(
    String(await jsx(context.Provider, { value: null }, unsafe).toString()),
    escaped
  )
  assert.equal(
    await new Response(await renderToReadableStream([unsafe])).text(),
    escaped
  )
  assert.equal(
    renderToString(jsx("p", {}, "Ordinary content")),
    "<p>Ordinary content</p>"
  )
})
