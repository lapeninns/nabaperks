import assert from "node:assert/strict"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
const PRODUCTION_HOSTS = new Set([
  "nabaperks.com",
  "www.nabaperks.com",
  "nabaperks.vercel.app",
])
const PRODUCTION_SUPABASE_PROJECT_REF = "skonlhwstejberyzobep"
const LOCAL_MODE = "local"
const ISOLATED_STAGING_MODE = "isolated-staging"

const DEFAULT_THRESHOLDS = Object.freeze({
  queryMedianMs: 250,
  queryMaxMs: 750,
  httpMedianMs: 750,
  httpMaxMs: 2_000,
})

export function resolvePerfStressPolicy(env) {
  const mode = env.PERF_STRESS_TARGET_MODE?.trim() || LOCAL_MODE
  assert.ok(
    mode === LOCAL_MODE || mode === ISOLATED_STAGING_MODE,
    "PERF_STRESS_TARGET_MODE must be local or isolated-staging"
  )

  const appUrl = parseHttpOrigin(
    env.PERF_STRESS_APP_URL?.trim() || "http://127.0.0.1:3000",
    "performance app URL"
  )
  const supabaseUrl = parseHttpOrigin(
    required(env, "NEXT_PUBLIC_SUPABASE_URL"),
    "performance Supabase URL"
  )
  const dbUrl = parseDatabaseUrl(required(env, "SUPABASE_DB_URL"))

  for (const target of [appUrl, supabaseUrl, dbUrl]) {
    assertNotProduction(target)
  }

  if (mode === LOCAL_MODE) {
    for (const [label, target] of [
      ["app", appUrl],
      ["Supabase", supabaseUrl],
      ["database", dbUrl],
    ]) {
      assert.ok(
        isLoopback(target.hostname),
        `${label} target must use loopback in local performance mode`
      )
    }
  } else {
    const projectRef = required(
      env,
      "PERF_STRESS_ISOLATED_STAGING_PROJECT_REF"
    ).toLowerCase()
    assert.match(projectRef, /^[a-z\d]{20}$/, "invalid staging project ref")
    assert.notEqual(
      projectRef,
      PRODUCTION_SUPABASE_PROJECT_REF,
      "refusing to stress the production Supabase project"
    )
    assert.equal(
      env.PERF_STRESS_ISOLATED_STAGING_CONFIRMED,
      "1",
      "isolated staging performance mode requires explicit confirmation"
    )
    assert.equal(
      appUrl.origin,
      parseHttpOrigin(
        required(env, "PERF_STRESS_ISOLATED_STAGING_APP_ORIGIN"),
        "allowlisted staging app origin"
      ).origin,
      "performance app target is not the allowlisted isolated staging origin"
    )
    assert.equal(
      supabaseUrl.origin,
      parseHttpOrigin(
        required(env, "PERF_STRESS_ISOLATED_STAGING_SUPABASE_ORIGIN"),
        "allowlisted staging Supabase origin"
      ).origin,
      "performance Supabase target is not the allowlisted isolated staging origin"
    )
    assert.equal(
      dbUrl.hostname,
      required(env, "PERF_STRESS_ISOLATED_STAGING_DB_HOST").toLowerCase(),
      "performance database target is not the allowlisted isolated staging host"
    )
    assert.ok(
      supabaseUrl.hostname.includes(projectRef),
      "performance Supabase URL does not identify the staging project ref"
    )
    assert.ok(
      dbUrl.hostname.includes(projectRef) ||
        dbUrl.username.toLowerCase().endsWith(`.${projectRef}`),
      "performance database URL does not identify the staging project ref"
    )
    assert.equal(
      appUrl.protocol,
      "https:",
      "isolated staging app must use HTTPS"
    )
    assert.match(
      appUrl.hostname,
      /\.vercel\.app$/,
      "isolated staging app must use an immutable Vercel deployment origin"
    )
    assert.equal(
      supabaseUrl.protocol,
      "https:",
      "isolated staging Supabase must use HTTPS"
    )
  }

  return {
    appOrigin: appUrl.origin,
    mode,
    thresholds: {
      queryMedianMs: positiveNumber(
        env.PERF_STRESS_MAX_QUERY_MEDIAN_MS,
        DEFAULT_THRESHOLDS.queryMedianMs,
        "query median threshold"
      ),
      queryMaxMs: positiveNumber(
        env.PERF_STRESS_MAX_QUERY_MAX_MS,
        DEFAULT_THRESHOLDS.queryMaxMs,
        "query max threshold"
      ),
      httpMedianMs: positiveNumber(
        env.PERF_STRESS_MAX_HTTP_MEDIAN_MS,
        DEFAULT_THRESHOLDS.httpMedianMs,
        "HTTP median threshold"
      ),
      httpMaxMs: positiveNumber(
        env.PERF_STRESS_MAX_HTTP_MAX_MS,
        DEFAULT_THRESHOLDS.httpMaxMs,
        "HTTP max threshold"
      ),
    },
  }
}

export function assertStagingHealth(payload, mode) {
  assert.ok(
    payload && typeof payload === "object",
    "app health payload is invalid"
  )

  if (mode === ISOLATED_STAGING_MODE) {
    assert.equal(
      payload.targetEnvironment,
      "staging",
      "hosted performance target did not identify as isolated staging"
    )
    assert.notEqual(
      payload.environment,
      "production",
      "refusing to stress a production environment"
    )
  }
}

export function assertPerformanceBudgets(queryRows, httpRows, thresholds) {
  const violations = [
    ...budgetViolations(
      queryRows,
      thresholds.queryMedianMs,
      thresholds.queryMaxMs
    ),
    ...budgetViolations(
      httpRows,
      thresholds.httpMedianMs,
      thresholds.httpMaxMs
    ),
  ]

  assert.equal(
    violations.length,
    0,
    `Performance budgets failed:\n${violations.join("\n")}`
  )
}

function budgetViolations(rows, medianLimit, maxLimit) {
  return rows.flatMap((row) => {
    const violations = []
    if (row.median > medianLimit) {
      violations.push(
        `${row.label} median ${row.median.toFixed(1)}ms exceeds ${medianLimit}ms`
      )
    }
    if (row.max > maxLimit) {
      violations.push(
        `${row.label} max ${row.max.toFixed(1)}ms exceeds ${maxLimit}ms`
      )
    }
    return violations
  })
}

function parseHttpOrigin(raw, label) {
  const url = new URL(raw)
  assert.match(url.protocol, /^https?:$/, `${label} must use HTTP or HTTPS`)
  assert.equal(url.username, "", `${label} must not contain credentials`)
  assert.equal(url.password, "", `${label} must not contain credentials`)
  assert.equal(url.pathname, "/", `${label} must be an origin without a path`)
  assert.equal(url.search, "", `${label} must not contain a query`)
  assert.equal(url.hash, "", `${label} must not contain a fragment`)
  return url
}

function parseDatabaseUrl(raw) {
  const url = new URL(raw)
  assert.match(
    url.protocol,
    /^postgres(?:ql)?:$/,
    "performance database URL must use PostgreSQL"
  )
  return url
}

function assertNotProduction(url) {
  assert.ok(
    !PRODUCTION_HOSTS.has(url.hostname.toLowerCase()),
    `refusing to stress production host "${url.hostname}"`
  )
}

function isLoopback(hostname) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

function positiveNumber(raw, fallback, label) {
  const value = raw === undefined || raw === "" ? fallback : Number(raw)
  assert.ok(Number.isFinite(value) && value > 0, `${label} must be positive`)
  return value
}

function required(env, name) {
  const value = env[name]?.trim()
  assert.ok(value, `${name} is required`)
  return value
}
