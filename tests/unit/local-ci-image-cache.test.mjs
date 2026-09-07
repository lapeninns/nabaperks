import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  buildImageCacheLoadArgv,
  IMAGE_CACHE_MANIFEST,
  IMAGE_CACHE_MANIFEST_SHA256,
  parseImageCachePin,
} from "../../ops/local-ci/core/image-cache.mjs"

const archive = "fixture archive bytes\n"
const pin = {
  archiveSha256: createHash("sha256").update(archive).digest("hex"),
  manifestSha256: IMAGE_CACHE_MANIFEST_SHA256,
}
const options = {
  pin,
  vm: "nabaperks-ci",
  daemonName: "nabaperks-ci-dind-ffffffffffff-db-1",
}

test("a cache is optional, but an installed stale or malformed pin fails closed", () => {
  assert.equal(parseImageCachePin(null), null)
  assert.deepEqual(parseImageCachePin(JSON.stringify(pin)), pin)
  for (const value of [
    "",
    "bad JSON",
    {},
    [],
    { ...pin, archiveSha256: "../archive" },
    { ...pin, manifestSha256: "a".repeat(64) },
  ]) {
    assert.throws(() => parseImageCachePin(value), {
      code: "INVALID_IMAGE_CACHE",
    })
  }
  assert.throws(() => buildImageCacheLoadArgv({ ...options, vm: null }), {
    code: "INVALID_IMAGE_CACHE",
  })
  assert.throws(
    () => buildImageCacheLoadArgv({ ...options, daemonName: "postgres" }),
    { code: "INVALID_IMAGE_CACHE" }
  )
})

test("archive streaming stays in the VM and contains only the reviewed image identities", () => {
  const argv = buildImageCacheLoadArgv(options)
  assert.deepEqual(argv.slice(0, 6), [
    "limactl",
    "shell",
    "nabaperks-ci",
    "--",
    "/bin/sh",
    "-c",
  ])
  assert.deepEqual(
    argv.slice(-26),
    IMAGE_CACHE_MANIFEST.images.flatMap(({ tag, configDigest }) => [
      tag,
      configDigest,
    ])
  )
  assert.equal(
    argv.some((word) => word.includes("/Users/")),
    false
  )
  assert.equal(argv.includes("--volume"), false)
  assert.equal(argv.includes("--mount"), false)
})

function loadFixture(
  t,
  { corrupt = false, wrongImage = false, symlink = false } = {}
) {
  const folder = mkdtempSync(join(tmpdir(), "local-ci-image-cache-"))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const file = join(folder, "archive.tar")
  writeFileSync(file, corrupt ? "corrupt bytes" : archive)
  const marker = join(folder, "loaded")
  const fakeDocker = join(folder, "docker")
  const ids = new Map(
    IMAGE_CACHE_MANIFEST.images.map(({ tag, configDigest }) => [
      tag,
      configDigest,
    ])
  )
  writeFileSync(
    fakeDocker,
    `#!${process.execPath}\n${[
      'const fs = require("node:fs")',
      `const ids = new Map(${JSON.stringify([...ids])})`,
      'if (process.argv.includes("load")) {',
      `  fs.writeFileSync(${JSON.stringify(marker)}, fs.readFileSync(0))`,
      '} else if (process.argv.includes("inspect")) {',
      `  process.stdout.write(${wrongImage ? '"sha256:wrong"' : "ids.get(process.argv.at(-1))"} + "\\n")`,
      "} else { process.exitCode = 1 }",
    ].join("\n")}\n`,
    { mode: 0o755 }
  )
  const argv = buildImageCacheLoadArgv({ ...options, docker: fakeDocker })
  const pathIndex = argv.findIndex((word) => word.endsWith(".tar"))
  if (symlink) {
    symlinkSync(file, join(folder, "link.tar"))
    argv[pathIndex] = join(folder, "link.tar")
  } else argv[pathIndex] = file
  return {
    result: spawnSync(argv[4], argv.slice(5), { encoding: "utf8" }),
    marker,
  }
}

test("a corrupted or symlinked archive is rejected before Docker receives any bytes", (t) => {
  for (const fixture of [{ corrupt: true }, { symlink: true }]) {
    const { result, marker } = loadFixture(t, fixture)
    assert.notEqual(result.status, 0)
    assert.throws(() => readFileSync(marker), { code: "ENOENT" })
  }
})

test("verified archive bytes stream to the sidecar and every loaded tag is checked", (t) => {
  const { result, marker } = loadFixture(t)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readFileSync(marker, "utf8"), archive)
  const wrong = loadFixture(t, { wrongImage: true })
  assert.notEqual(
    wrong.result.status,
    0,
    "a correct archive hash cannot substitute for expected image identities"
  )
})

test("operator preparer preserves resume progress and rejects unverified registry content", () => {
  const result = spawnSync(
    "python3",
    [new URL("./local-ci-image-cache-python.py", import.meta.url).pathname],
    { encoding: "utf8" }
  )
  assert.equal(result.status, 0, result.stderr)
})
