const TAP_VERSION = "TAP version 13"

function tapTitle(title) {
  return title.replace(/[\r\n]/g, " ")
}

function tapResult(result) {
  if (result.status === "passed") return { kind: "pass", skip: false }
  if (result.status === "skipped") return { kind: "pass", skip: true }
  return { kind: "fail", skip: false }
}

export default class PlaywrightTapReporter {
  #now
  #startedAt = 0
  #tests = []
  #write

  constructor(options = {}) {
    this.#now = options.now ?? (() => performance.now())
    this.#write = options.write ?? ((chunk) => process.stdout.write(chunk))
  }

  onBegin() {
    this.#startedAt = this.#now()
  }

  onTestEnd(test, result) {
    this.#tests.push({ title: tapTitle(test.title), ...tapResult(result) })
  }

  onError(error) {
    this.#tests.push({
      title: tapTitle(error.message ?? "Playwright execution error"),
      kind: "fail",
      skip: false,
    })
  }

  onEnd() {
    const totals = this.#tests.reduce(
      (current, test) => ({
        passed: current.passed + (test.kind === "pass" ? 1 : 0),
        failed: current.failed + (test.kind === "fail" ? 1 : 0),
        skipped: current.skipped + (test.skip ? 1 : 0),
      }),
      { passed: 0, failed: 0, skipped: 0 }
    )
    const assertions = this.#tests.map((test, index) => {
      const status = test.kind === "pass" ? "ok" : "not ok"
      return `${status} ${index + 1} - ${test.title}${test.skip ? " # SKIP" : ""}`
    })
    const duration = Math.max(0, this.#now() - this.#startedAt)
    this.#write(
      [
        TAP_VERSION,
        ...assertions,
        `1..${this.#tests.length}`,
        `# tests ${this.#tests.length}`,
        "# suites 0",
        `# pass ${totals.passed}`,
        `# fail ${totals.failed}`,
        "# cancelled 0",
        `# skipped ${totals.skipped}`,
        "# todo 0",
        `# duration_ms ${duration}`,
        "",
      ].join("\n")
    )
  }
}
