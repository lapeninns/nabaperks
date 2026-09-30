import assert from "node:assert/strict"
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { provisionDisposablePlatform } from "../../scripts/release/disposable-platform.mjs"

function withFailedPlatform(
  { cleanupFails = false, noisy = false, registry = "ghcr.io" },
  check
) {
  const root = mkdtempSync(join(tmpdir(), "platform-command-test-"))
  const record = join(root, "record.json")
  const originalPath = process.env.PATH
  const originalRegistry = process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY
  const originalSecret = process.env.SUPABASE_ACCESS_TOKEN
  writeFileSync(
    join(root, "supabase"),
    `#!${process.execPath}
const fs = require("node:fs");
const command = process.argv[2];
fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({
  root: process.cwd(), command, registry: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY,
  hasSecret: "SUPABASE_ACCESS_TOKEN" in process.env
}));
if (command === "init") {
  fs.mkdirSync("supabase");
  fs.writeFileSync("supabase/config.toml", 'project_id = "fixture"\\nport = 54321\\n');
} else if (command === "start" || (command === "stop" && ${cleanupFails})) {
  process.stdout.write("binary-dump-must-not-be-logged");
  process.stderr.write(${noisy} ? "x".repeat(10000) : "");
  process.stderr.write(command + " HTTP 502 https://user:private-password@localhost/test");
  process.exit(1);
}
`,
    { mode: 0o700 }
  )
  process.env.PATH = root
  process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY = registry
  process.env.SUPABASE_ACCESS_TOKEN = "must-not-enter-the-child"
  try {
    let failure
    try {
      provisionDisposablePlatform()
    } catch (error) {
      failure = error
    }
    assert.ok(failure, "Failed startup must block qualification")
    check(failure, JSON.parse(readFileSync(record, "utf8")))
  } finally {
    for (const [key, value] of Object.entries({
      PATH: originalPath,
      SUPABASE_INTERNAL_IMAGE_REGISTRY: originalRegistry,
      SUPABASE_ACCESS_TOKEN: originalSecret,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (existsSync(record)) {
      rmSync(JSON.parse(readFileSync(record, "utf8")).root, {
        recursive: true,
        force: true,
      })
    }
    rmSync(root, { recursive: true, force: true })
  }
}

test("disposable startup preserves the reviewed registry without provider credentials", () => {
  withFailedPlatform({}, (error, record) => {
    assert.equal(record.registry, "ghcr.io")
    assert.equal(record.hasSecret, false)
    assert.equal(
      record.command,
      "stop",
      "Owned startup resources must be cleaned"
    )
    assert.match(error.message, /supabase start failed/)
    assert.match(error.message, /HTTP 502/)
    assert.doesNotMatch(
      error.message,
      /private-password|binary-dump-must-not-be-logged/
    )
  })
})

test("disposable failure diagnostics are bounded and retain startup and cleanup failures", () => {
  withFailedPlatform({ cleanupFails: true, noisy: true }, (error) => {
    assert.ok(error instanceof AggregateError)
    assert.match(error.message, /supabase start failed/)
    assert.match(error.message, /supabase stop failed/)
    assert.match(error.message, /HTTP 502/)
    assert.ok(error.message.length < 5000)
    assert.doesNotMatch(
      error.message,
      /private-password|binary-dump-must-not-be-logged/
    )
  })
})

test("disposable commands do not inherit an arbitrary host registry", () => {
  withFailedPlatform({ registry: "private.example.test" }, (_error, record) => {
    assert.equal(record.registry, undefined)
    assert.equal(record.hasSecret, false)
  })
})
