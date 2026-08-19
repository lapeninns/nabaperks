import assert from "node:assert/strict"
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const checkerPath = join(process.cwd(), "scripts/check-agent-docs.mjs")
const requiredPaths = [
  "DESIGN.md",
  "docs/operations/agent-readiness.md",
  "docs/operations/incident-response.md",
  "docs/operations/production-runbook.md",
  "docs/api/openapi.json",
  "config/env-contract.json",
]
const requiredCommands = ["quality:fast", "quality:check", "build"]

function writeFixture({ agents, packageContents, scripts }) {
  const fixture = mkdtempSync(join(tmpdir(), "nabaperks-agent-docs-"))
  mkdirSync(join(fixture, "scripts"))
  cpSync(checkerPath, join(fixture, "scripts/check-agent-docs.mjs"))
  writeFileSync(join(fixture, "AGENTS.md"), agents)
  writeFileSync(
    join(fixture, "package.json"),
    packageContents ?? JSON.stringify({ scripts })
  )

  for (const path of requiredPaths) {
    const destination = join(fixture, path)
    mkdirSync(join(destination, ".."), { recursive: true })
    writeFileSync(destination, "fixture")
  }

  return fixture
}

function runFixture(fixture) {
  return spawnSync(process.execPath, ["scripts/check-agent-docs.mjs"], {
    cwd: fixture,
    encoding: "utf8",
  })
}

function assertRejected(result, diagnostic) {
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, new RegExp(`\\b${diagnostic}\\b`))
  assert.doesNotMatch(result.stdout, /is current/)
}

function documentedGuide({ designPath = "DESIGN.md", commands }) {
  const references = requiredPaths
    .map((path) => `- \`${path === "DESIGN.md" ? designPath : path}\``)
    .join("\n")
  return `${references}\n\n\`\`\`bash\n${commands.join("\n")}\n\`\`\`\n`
}

function fixtureScripts(overrides = {}) {
  return {
    "quality:fast": "node scripts/fast-check.mjs",
    "quality:check": "node scripts/full-check.mjs",
    build: "node scripts/build.mjs",
    ...overrides,
  }
}

test("Given malformed agent documentation When the integrity checker runs Then only exact documented commands paths and targets pass", () => {
  const fixtures = []

  try {
    const validFixture = writeFixture({
      agents: documentedGuide({
        commands: requiredCommands.map((command) => `pnpm ${command}`),
      }),
      scripts: fixtureScripts(),
    })
    fixtures.push(validFixture)
    assert.equal(runFixture(validFixture).status, 0)

    const substringPathFixture = writeFixture({
      agents: documentedGuide({
        designPath: "DESIGN.md.backup",
        commands: requiredCommands.map((command) => `pnpm ${command}`),
      }),
      scripts: fixtureScripts(),
    })
    fixtures.push(substringPathFixture)
    assertRejected(
      runFixture(substringPathFixture),
      "AGENT_DOCS_PATH_REFERENCE_MISSING"
    )

    const whitespaceCommandFixture = writeFixture({
      agents: documentedGuide({
        commands: ["pnpm    quality:fast", "pnpm quality:check", "pnpm build"],
      }),
      scripts: fixtureScripts(),
    })
    fixtures.push(whitespaceCommandFixture)
    assert.equal(runFixture(whitespaceCommandFixture).status, 0)

    const targetDriftFixture = writeFixture({
      agents: documentedGuide({
        commands: requiredCommands.map((command) => `pnpm ${command}`),
      }),
      scripts: fixtureScripts({ "quality:fast": "pnpm missing:target" }),
    })
    fixtures.push(targetDriftFixture)
    assertRejected(
      runFixture(targetDriftFixture),
      "AGENT_DOCS_SCRIPT_TARGET_MISSING"
    )

    const proseCommandFixture = writeFixture({
      agents: `${documentedGuide({
        commands: ["pnpm quality:fast", "pnpm quality:check"],
      })}\nDo not execute \`pnpm build\` from prose.\n`,
      scripts: fixtureScripts(),
    })
    fixtures.push(proseCommandFixture)
    assertRejected(
      runFixture(proseCommandFixture),
      "AGENT_DOCS_REQUIRED_COMMAND_MISSING"
    )

    const malformedPackageFixture = writeFixture({
      agents: documentedGuide({
        commands: requiredCommands.map((command) => `pnpm ${command}`),
      }),
      packageContents: "{",
    })
    fixtures.push(malformedPackageFixture)
    assertRejected(
      runFixture(malformedPackageFixture),
      "AGENT_DOCS_PACKAGE_JSON_INVALID"
    )
  } finally {
    for (const fixture of fixtures)
      rmSync(fixture, { recursive: true, force: true })
  }
})
