import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist`)
  return readFileSync(path, "utf8")
}

test("Given local changes When an agent prepares a commit Then fast quality hooks run", () => {
  const packageJson = JSON.parse(read("package.json"))
  const hook = read(".husky/pre-commit")

  assert.equal(packageJson.scripts.prepare, "husky")
  assert.equal(typeof packageJson.scripts["quality:fast"], "string")
  assert.equal(typeof packageJson["lint-staged"], "object")
  assert.match(hook, /lint-staged/)
})

test("Given source changes When static quality runs Then size complexity dead code duplication and debt are enforced", () => {
  const packageJson = JSON.parse(read("package.json"))
  const eslint = read("eslint.config.mjs")
  const knip = read("knip.json")
  const jscpd = read("jscpd.json")
  const debtCheck = read("scripts/check-technical-debt.mjs")

  for (const script of [
    "deadcode:check",
    "duplicates:check",
    "debt:check",
    "quality:check",
  ]) {
    assert.equal(
      typeof packageJson.scripts[script],
      "string",
      `${script} must exist`
    )
  }
  assert.match(eslint, /complexity/)
  assert.match(eslint, /max-lines/)
  assert.match(knip, /unresolved/)
  assert.match(jscpd, /threshold/)
  assert.match(debtCheck, /TODO|FIXME/)
})

test("Given database-backed routes When query regressions run Then N plus one plans are analyzed", () => {
  const queryPlanTest = read("tests/db/rls-hashed-policies.test.mjs")

  assert.match(queryPlanTest, /N\+1 query detection/)
  assert.match(queryPlanTest, /explain \(analyze, format json\)/i)
  assert.match(queryPlanTest, /Actual Loops/)
})

test("Given a risky change When it is deployed Then flags have ownership expiry and stale-flag validation", () => {
  const packageJson = JSON.parse(read("package.json"))
  const flags = JSON.parse(read("config/feature-flags.json"))
  const runtime = read("lib/feature-flags.ts")
  const instrumentation = read("instrumentation.ts")

  assert.equal(typeof packageJson.scripts["flags:check"], "string")
  assert.ok(flags.flags.length > 0)
  assert.ok(flags.flags.every((flag) => flag.owner && flag.expiresOn))
  assert.match(runtime, /isFeatureEnabled/)
  assert.match(instrumentation, /platform_error_reporting/)
})

test("Given HTTP APIs When docs are generated Then a valid source-linked OpenAPI contract stays current", () => {
  const packageJson = JSON.parse(read("package.json"))
  const openapi = JSON.parse(read("docs/api/openapi.json"))
  const generatedDocs = read("docs/api/README.md")
  const generator = read("scripts/generate-api-docs.mjs")

  assert.match(openapi.openapi, /^3\./)
  assert.ok(Object.keys(openapi.paths).length >= 2)
  assert.match(generatedDocs, /Generated from `docs\/api\/openapi\.json`/)
  assert.match(generator, /x-source/)
  assert.equal(typeof packageJson.scripts["docs:check"], "string")
})

test("Given an autonomous agent When it enters the repository Then current commands conventions and a focused skill are discoverable", () => {
  const agents = read("AGENTS.md")
  const skill = read(".factory/skills/nabaperks-readiness/SKILL.md")
  const freshness = read("scripts/check-agent-docs.mjs")

  assert.match(agents, /pnpm quality:fast/)
  assert.match(agents, /camelCase/)
  assert.match(agents, /docs\/operations\/agent-readiness\.md/)
  assert.match(skill, /^---[\s\S]*name:[\s\S]*description:/)
  assert.match(freshness, /AGENTS\.md/)
})

test("Given a production error When observability is configured Then it carries context source maps alerts and issue automation", () => {
  const packageJson = JSON.parse(read("package.json"))
  const nextConfig = read("next.config.ts")
  const instrumentation = read("instrumentation.ts")
  const serverConfig = read("sentry.server.config.ts")
  const edgeConfig = read("sentry.edge.config.ts")
  const clientConfig = read("instrumentation-client.ts")
  const smoke = read(".github/workflows/production-smoke.yml")

  assert.equal(typeof packageJson.dependencies["@sentry/nextjs"], "string")
  assert.match(nextConfig, /withSentryConfig/)
  assert.match(instrumentation, /captureRequestError/)
  for (const config of [serverConfig, edgeConfig, clientConfig]) {
    assert.match(config, /sendDefaultPii:\s*false/)
    assert.match(config, /tracesSampleRate/)
  }
  assert.match(smoke, /issues:\s*write/)
  assert.match(smoke, /Create or update incident issue/)
})

test("Given routine pull requests When CI runs Then deep browser proof is sharded for sub-ten-minute feedback", () => {
  const ci = read(".github/workflows/ci.yml")
  const playwright = read("playwright.config.ts")
  const release = read(".github/workflows/release-notes.yml")
  const buildJob = ci.slice(ci.indexOf("  build:"), ci.indexOf("\n  e2e:"))

  assert.match(ci, /quality:check/)
  assert.match(ci, /shard: \[1\/2, 2\/2\]/)
  assert.match(ci, /--shard/)
  assert.match(ci, /PLAYWRIGHT_WORKERS: "2"/)
  assert.match(playwright, /fullyParallel: true/)
  assert.match(playwright, /workers: localWorkers/)
  assert.doesNotMatch(buildJob, /e2e:install/)

  for (const [job, protectedName, dependency] of [
    ["e2e-gate", "E2E \\(DB-free harness tier\\)", "e2e"],
    ["a11y-gate", "Accessibility sweep", "a11y"],
    ["visual-gate", "Visual regression", "visual"],
    ["lighthouse-gate", "Lighthouse CI", "lighthouse"],
  ]) {
    assert.match(
      ci,
      new RegExp(
        `  ${job}:[\\s\\S]*?name: ${protectedName}[\\s\\S]*?needs: ${dependency}`
      )
    )
  }

  assert.match(ci, /--collect\.url=/)
  assert.match(release, /release-drafter/)
})

test("Given a reportable task When an issue is opened Then structured bug feature debt and incident templates exist", () => {
  for (const path of [
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/feature.yml",
    ".github/ISSUE_TEMPLATE/technical-debt.yml",
    ".github/ISSUE_TEMPLATE/incident.yml",
  ]) {
    const template = read(path)
    assert.match(template, /name:/)
    assert.match(template, /labels:/)
    assert.match(template, /body:/)
  }
})
