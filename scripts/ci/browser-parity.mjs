// Inventory is selection evidence only. Runtime outcomes and resource measurements
// are separately mandatory before any proposal can claim grouping parity.
export function testIdentity(test) {
  if (
    !test ||
    typeof test.project !== "string" ||
    typeof test.file !== "string" ||
    !Array.isArray(test.title) ||
    test.title.some((part) => typeof part !== "string")
  )
    throw new Error("Invalid browser test identity")
  return JSON.stringify([
    test.project,
    test.file.replaceAll("\\", "/"),
    test.title,
  ])
}

export function compareInventory(before, after) {
  function counts(tests) {
    if (!Array.isArray(tests) || tests.length === 0)
      throw new Error("Browser inventory must be non-empty")
    const result = new Map()
    for (const test of tests) {
      const key = testIdentity(test)
      result.set(key, (result.get(key) ?? 0) + 1)
    }
    return result
  }
  const left = counts(before),
    right = counts(after)
  const differences = [...new Set([...left.keys(), ...right.keys()])]
    .filter((key) => left.get(key) !== right.get(key))
    .map((identity) => ({
      identity,
      before: left.get(identity) ?? 0,
      after: right.get(identity) ?? 0,
    }))
  return { equivalent: differences.length === 0, differences }
}

export function compareBrowserEvidence(before, after, budget) {
  const inventory = compareInventory(before.tests, after.tests)
  const failures = inventory.differences.map(
    (entry) => `Identity multiplicity changed: ${entry.identity}`
  )
  const outcomes = (tests) =>
    tests
      .map((test) => {
        if (
          !["passed", "skipped"].includes(test.status) ||
          !Number.isInteger(test.retries) ||
          test.retries < 0 ||
          typeof test.skipReason !== "string" ||
          typeof test.flaky !== "boolean"
        )
          throw new Error("Missing or unsuccessful runtime test evidence")
        if (test.flaky || test.retries !== 0)
          throw new Error("Flaky or retried test cannot qualify grouping")
        if (test.status === "skipped" && !test.skipReason)
          throw new Error("Skip evidence needs a reason")
        return JSON.stringify([
          testIdentity(test),
          test.status,
          test.skipReason,
          test.flaky,
          test.retries,
        ])
      })
      .sort()
  if (
    JSON.stringify(outcomes(before.tests)) !==
    JSON.stringify(outcomes(after.tests))
  )
    failures.push("Runtime outcomes or skip reasons changed")
  for (const key of [
    "workers",
    "retries",
    "failOnFlakyTests",
    "forbidOnly",
    "browserVersion",
    "platform",
    "architecture",
    "heapMb",
  ]) {
    if (
      before.policy?.[key] === undefined ||
      before.policy[key] !== after.policy?.[key]
    )
      failures.push(`Execution policy mismatch: ${key}`)
  }
  if (
    before.policy?.workers !== 1 ||
    before.policy?.retries !== 1 ||
    before.policy?.failOnFlakyTests !== true ||
    before.policy?.forbidOnly !== true
  )
    failures.push("Required CI browser policy missing")
  for (const evidence of [before, after]) {
    if (
      evidence.execution?.exitCode !== 0 ||
      evidence.execution?.complete !== true ||
      !Array.isArray(evidence.execution?.globalErrors) ||
      evidence.execution.globalErrors.length !== 0
    )
      failures.push(
        "Complete successful process and global teardown evidence required"
      )
    for (const key of ["maxRssMb", "durationMs", "serverStarts"]) {
      if (
        !Number.isFinite(evidence.resources?.[key]) ||
        evidence.resources[key] <= 0
      )
        failures.push(`Missing measured resource: ${key}`)
    }
    if (evidence.resources?.serverRestarts !== 0)
      failures.push("Server restarts or missing restart measurement")
  }
  for (const key of ["maxRssMb", "durationMs"]) {
    if (
      !Number.isFinite(budget?.[key]) ||
      budget[key] <= 0 ||
      after.resources?.[key] > budget[key]
    )
      failures.push(`Resource budget exceeded or absent: ${key}`)
  }
  return { equivalent: failures.length === 0, failures }
}

// Consume Playwright's JSON reporter for both --list and executed reports.
// Runtime records are emitted only when actual results exist; listing alone
// cannot fabricate a passed test, resource measurement or skip reason.
export function inventoryFromPlaywright(report) {
  if (!Array.isArray(report?.suites))
    throw new Error("Invalid Playwright JSON report")
  if (
    report.errors !== undefined &&
    (!Array.isArray(report.errors) || report.errors.length > 0)
  )
    throw new Error("Playwright report has global errors")
  if (report.stats?.unexpected > 0)
    throw new Error("Playwright report has unexpected outcomes")
  const records = []
  function visit(suites, titles = []) {
    for (const suite of suites) {
      const path = suite.title ? [...titles, suite.title] : titles
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const record = {
            project: test.projectName,
            file: spec.file ?? suite.file,
            title: [...path, spec.title],
          }
          testIdentity(record)
          if (test.results?.length) {
            if (!["expected", "skipped", "flaky"].includes(test.status))
              throw new Error(
                "Playwright test has missing or unexpected runtime outcome"
              )
            const result = test.results.at(-1)
            Object.assign(record, {
              status: result.status,
              retries: Math.max(0, test.results.length - 1),
              flaky: test.status === "flaky",
              skipReason: (test.annotations ?? [])
                .filter((annotation) =>
                  ["skip", "fixme"].includes(annotation.type)
                )
                .map((annotation) => annotation.description ?? "")
                .join("; "),
            })
          }
          records.push(record)
        }
      }
      visit(suite.suites ?? [], path)
    }
  }
  visit(report.suites)
  if (!records.length) throw new Error("Playwright report contains no tests")
  return records
}
