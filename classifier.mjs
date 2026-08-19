import { readFileSync, writeFileSync } from "node:fs"

const ROUTES = new Set(["home", "offers", "account", "checkout"])
const OUTCOMES = new Set([
  "COMPLETE_SYNTHETIC_CONTROL_ONLY",
  "INCOMPLETE",
  "FAIL",
  "NOT_CERTIFIED",
])
const poisonKeys = new Set(["__proto__", "constructor", "prototype"])

class InputError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function rejectPoison(value) {
  if (Array.isArray(value)) {
    value.forEach(rejectPoison)
    return
  }
  if (!isObject(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (poisonKeys.has(key)) throw new InputError("REJECTED_POISON_KEY")
    rejectPoison(child)
  }
}

function requireObject(value, code) {
  if (!isObject(value)) throw new InputError(code)
  return value
}

function requireKeys(value, required, optional = []) {
  const object = requireObject(value, "REJECTED_OBJECT")
  const permitted = new Set([...required, ...optional])
  for (const key of Object.keys(object)) {
    if (!permitted.has(key)) throw new InputError("REJECTED_UNKNOWN_KEY")
  }
  for (const key of required) {
    if (!(key in object)) throw new InputError("REJECTED_MISSING_KEY")
  }
  return object
}

function requireString(value) {
  if (typeof value !== "string") throw new InputError("REJECTED_STRING")
  return value
}

function requireBoolean(value) {
  if (typeof value !== "boolean") throw new InputError("REJECTED_BOOLEAN")
  return value
}

function deepMerge(base, patch) {
  if (!isObject(base) || !isObject(patch)) return patch
  const merged = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = deepMerge(base[key], value)
  }
  return merged
}

function parseMetadata(input) {
  const value = requireKeys(
    input,
    [
      "mode",
      "source",
      "execution",
      "artifacts",
      "routes",
      "bundle",
      "webVitals",
    ],
    ["aggregateState", "inertPromptInjection"]
  )
  requireString(value.mode)
  const source = requireKeys(value.source, [
    "sourceRef",
    "buildRef",
    "reportsRef",
  ])
  Object.values(source).forEach(requireString)
  const execution = requireKeys(value.execution, ["kind", "command", "repeat"])
  Object.values(execution).forEach(requireString)
  const artifacts = requireKeys(value.artifacts, ["state", "nonempty"])
  requireString(artifacts.state)
  requireBoolean(artifacts.nonempty)
  if (!Array.isArray(value.routes))
    throw new InputError("REJECTED_ROUTES_ARRAY")
  const routes = value.routes.map((route) => {
    const parsed = requireKeys(route, [
      "route",
      "terminal",
      "nonempty",
      "assertions",
    ])
    requireString(parsed.route)
    requireString(parsed.terminal)
    requireBoolean(parsed.nonempty)
    requireString(parsed.assertions)
    return parsed
  })
  const bundle = requireKeys(value.bundle, [
    "truth",
    "nonempty",
    "assertions",
    "sourceRef",
  ])
  requireString(bundle.truth)
  requireBoolean(bundle.nonempty)
  requireString(bundle.assertions)
  requireString(bundle.sourceRef)
  const webVitals = requireKeys(value.webVitals, [
    "contract",
    "nonempty",
    "runtime",
    "assertions",
    "sourceRef",
    "metricBudget",
  ])
  requireString(webVitals.contract)
  requireBoolean(webVitals.nonempty)
  requireString(webVitals.runtime)
  requireString(webVitals.assertions)
  requireString(webVitals.sourceRef)
  requireString(webVitals.metricBudget)
  if ("aggregateState" in value) requireString(value.aggregateState)
  if ("inertPromptInjection" in value) requireString(value.inertPromptInjection)
  return { ...value, source, execution, artifacts, routes, bundle, webVitals }
}

function classify(input) {
  const metadata = parseMetadata(input)
  const { source, execution, artifacts, routes, bundle, webVitals } = metadata
  const exactBinding =
    source.sourceRef === source.buildRef &&
    source.sourceRef === source.reportsRef
  const componentBinding =
    bundle.sourceRef === source.sourceRef &&
    webVitals.sourceRef === source.sourceRef
  if (
    metadata.mode !== "synthetic-control-only" ||
    !exactBinding ||
    !componentBinding ||
    artifacts.state !== "clean"
  )
    return "NOT_CERTIFIED"
  if (execution.kind !== "production-build" || execution.repeat !== "agree")
    return "NOT_CERTIFIED"
  if (
    bundle.truth !== "verified" ||
    !bundle.nonempty ||
    webVitals.contract !== "proved" ||
    !webVitals.nonempty ||
    webVitals.runtime !== "production" ||
    webVitals.metricBudget !== "configured"
  )
    return "NOT_CERTIFIED"
  if (execution.command === "hung" || execution.command === "cancelled")
    return "INCOMPLETE"
  if (execution.command === "failed") return "FAIL"
  if (execution.command !== "completed" || !artifacts.nonempty)
    return "INCOMPLETE"
  const routeNames = new Set(routes.map((route) => route.route))
  if (
    routeNames.size !== ROUTES.size ||
    [...ROUTES].some((route) => !routeNames.has(route))
  )
    return "INCOMPLETE"
  if (routes.some((route) => route.terminal === "flaky")) return "NOT_CERTIFIED"
  if (
    routes.some(
      (route) => route.terminal === "failed" || route.assertions === "fail"
    )
  )
    return "FAIL"
  if (routes.some((route) => route.terminal !== "complete" || !route.nonempty))
    return "INCOMPLETE"
  if (bundle.assertions === "fail" || webVitals.assertions === "fail")
    return "FAIL"
  if (bundle.assertions !== "pass" || webVitals.assertions !== "pass")
    return "NOT_CERTIFIED"
  return "COMPLETE_SYNTHETIC_CONTROL_ONLY"
}

function parseFixtureDocument(document) {
  rejectPoison(document)
  const value = requireKeys(document, ["schema", "baseline", "cases"])
  if (value.schema !== "t26-performance-controls-v1")
    throw new InputError("REJECTED_SCHEMA")
  if (!Array.isArray(value.cases)) throw new InputError("REJECTED_CASES_ARRAY")
  requireObject(value.baseline, "REJECTED_BASELINE")
  return value
}

function runFixtures(document) {
  const fixture = parseFixtureDocument(document)
  const results = fixture.cases.map((item) => {
    const caseValue = requireKeys(item, ["id", "expected", "overrides"])
    const id = requireString(caseValue.id)
    const expected = requireString(caseValue.expected)
    if (!OUTCOMES.has(expected))
      throw new InputError("REJECTED_EXPECTED_OUTCOME")
    requireObject(caseValue.overrides, "REJECTED_OVERRIDES")
    const actual = classify(deepMerge(fixture.baseline, caseValue.overrides))
    return { id, expected, actual, matches: expected === actual }
  })
  const counts = Object.fromEntries(
    [...OUTCOMES].map((outcome) => [
      outcome,
      results.filter((result) => result.actual === outcome).length,
    ])
  )
  return {
    schema: "t26-performance-results-v1",
    cases: results,
    counts,
    allExpectedMatch: results.every((result) => result.matches),
    falseGreenCertified: 0,
  }
}

function parseArgs(args) {
  const [flag, fixturePath, outputFlag, outputPath] = args
  if (
    outputFlag !== "--out" ||
    !fixturePath ||
    !outputPath ||
    !["--fixtures", "--expect-rejection"].includes(flag)
  )
    throw new InputError("REJECTED_USAGE")
  return { flag, fixturePath, outputPath }
}

function main() {
  const { flag, fixturePath, outputPath } = parseArgs(process.argv.slice(2))
  const document = JSON.parse(readFileSync(fixturePath, "utf8"))
  if (flag === "--fixtures") {
    writeFileSync(
      outputPath,
      `${JSON.stringify(runFixtures(document), null, 2)}\n`
    )
    return
  }
  rejectPoison(document)
  const value = requireKeys(document, ["schema", "payloads"])
  if (
    value.schema !== "t26-performance-adversarial-v1" ||
    !Array.isArray(value.payloads)
  )
    throw new InputError("REJECTED_ADVERSARIAL_SCHEMA")
  const payloads = value.payloads.map((payload) => {
    const candidate = requireKeys(payload, ["id", "fixture"])
    try {
      runFixtures(candidate.fixture)
      return { id: candidate.id, rejected: false }
    } catch (error) {
      return { id: candidate.id, rejected: error instanceof InputError }
    }
  })
  const allRejected = payloads.every((payload) => payload.rejected)
  writeFileSync(
    outputPath,
    `${JSON.stringify({ schema: "t26-performance-adversarial-results-v1", payloads, allRejected }, null, 2)}\n`
  )
  if (!allRejected) process.exitCode = 1
}

try {
  main()
} catch (error) {
  process.stderr.write(
    `${error instanceof InputError ? error.code : "REJECTED_INPUT"}\n`
  )
  process.exitCode = 1
}
