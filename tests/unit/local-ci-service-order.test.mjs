import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildLaneScript } from "../../ops/local-ci/agent/runner.mjs"

test("background server starts only after successful dependency commands", () => {
  for (const fail of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), "ci-service-order-"))
    try {
      const lane = {
        id: "order",
        commands: [
          "curl() { test -f ready; }",
          fail ? "false" : "touch installed",
          "test -f ready",
        ],
        backgroundServices: [
          {
            id: "server",
            startAfter: 2,
            command: "test -f installed && touch ready",
            readiness: { url: "unused", attempts: 1, intervalSeconds: 0 },
          },
        ],
      }
      const script = buildLaneScript(lane, {}, { workspacePath: directory })
      const run = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
        timeout: 5000,
      })
      assert.equal(run.status, fail ? 1 : 0, run.stderr + run.stdout)
      assert.equal(existsSync(join(directory, "ready")), !fail)
      assert.throws(
        () =>
          buildLaneScript(
            {
              ...lane,
              backgroundServices: [
                { ...lane.backgroundServices[0], startAfter: 4 },
              ],
            },
            {},
            { workspacePath: directory }
          ),
        /command boundary/
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})
