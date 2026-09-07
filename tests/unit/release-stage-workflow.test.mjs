import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const database = readFileSync(
  ".github/workflows/production-database.yml",
  "utf8"
)
const deployment = readFileSync(
  ".github/workflows/production-deploy.yml",
  "utf8"
)
function step(source, name) {
  const start = source.indexOf(`      - name: ${name}\n`)
  assert.ok(start >= 0, name)
  const end = source.indexOf("\n      - ", start + 1)
  const block = source.slice(start, end < 0 ? undefined : end)
  const script = block.slice(block.indexOf("        run: |\n") + 15)
  return script
    .split("\n")
    .map((line) => line.replace(/^          /, ""))
    .join("\n")
}

test("database admission qualifies source and verifies current schema and alias before writes", () => {
  const qualification = database.indexOf(
    "Qualify unchanged runtime against the authenticated deployed baseline"
  )
  const preLedger = database.indexOf(
    "Require unchanged production schema before database application"
  )
  const guard = database.indexOf(
    "Recheck qualification and the unchanged live alias before database writes"
  )
  const apply = database.indexOf("      - name: Apply forward-only migrations")
  const record = database.indexOf("--stage database-applied")
  const upload = database.indexOf("name: production-database-stage-")
  assert.ok(
    qualification > 0 &&
      preLedger > qualification &&
      guard > preLedger &&
      apply > guard &&
      record > apply &&
      upload > record
  )
  assert.match(database, /RELEASE_RUN_ID: \$\{\{ github.run_id \}\}/)
  assert.match(database, /RELEASE_RUN_ATTEMPT: \$\{\{ github.run_attempt \}\}/)
  assert.doesNotMatch(database, /--compatibility|QUALIFICATION_BYPASS/)
  assert.match(
    step(
      database,
      "Qualify unchanged runtime against the authenticated deployed baseline"
    ),
    /deployed-baseline\.mjs[\s\S]*stage-ledger\.mjs qualify/
  )
})

test("application consumes exact attempt chain and records every stage around real operations", () => {
  assert.match(
    deployment,
    /name: production-database-stage-\$\{\{ inputs.release_run_id \}\}-\$\{\{ inputs.release_run_attempt \}\}/
  )
  assert.match(deployment, /path: \$\{\{ runner.temp \}\}\/release-ledger\//)
  const verify = deployment.indexOf(
    "Verify the database chain and live baseline before application mutations"
  )
  assert.ok(
    verify > 0 &&
      verify <
        deployment.indexOf("Deploy and prove the production alert receiver")
  )
  const promotion = step(deployment, "Promote the verified staged deployment")
  assert.ok(
    promotion.indexOf("--stage candidate-ready") <
      promotion.indexOf('pnpm exec vercel promote "$deployment_id"')
  )
  assert.ok(
    promotion.indexOf('pnpm exec vercel promote "$deployment_id"') <
      promotion.indexOf("--stage promoted")
  )
  const publicProof = deployment.indexOf(
    "Verify the exact promoted public revision under the release lock"
  )
  const verified = deployment.indexOf(
    "Record verified public proof and the complete release chain"
  )
  const candidate = deployment.indexOf(
    "Bind successful public proof to the release owner"
  )
  assert.ok(publicProof > 0 && verified > publicProof && candidate > verified)
  assert.match(
    step(deployment, "Package the immutable source revision"),
    /sourceDigest/
  )
  assert.match(
    step(
      deployment,
      "Record verified public proof and the complete release chain"
    ),
    /deployed-baseline\.mjs[\s\S]*--stage verified[\s\S]*stage-ledger\.mjs verify/
  )
})

test("actual database guard rejects stale ledger or changed live alias before a following mutation", () => {
  for (const mode of ["valid", "stale", "changed-alias"]) {
    const root = mkdtempSync(join(tmpdir(), "release-database-guard-"))
    try {
      mkdirSync(join(root, "release-ledger"))
      const baseline = {
        revision: "a".repeat(40),
        deploymentId: "dpl_old",
        observedAt: "earlier",
      }
      writeFileSync(
        join(root, "release-ledger/baseline.json"),
        JSON.stringify(baseline)
      )
      writeFileSync(
        join(root, "live.json"),
        JSON.stringify({
          ...baseline,
          observedAt: "later",
          ...(mode === "changed-alias" ? { deploymentId: "dpl_other" } : {}),
        })
      )
      writeFileSync(
        join(root, "node"),
        '#!/bin/sh\ncase "$1" in\n *stage-ledger.mjs) test "$MODE" != stale ;;\n *deployed-baseline.mjs) cp "$LIVE_FIXTURE" "$2" ;;\n *) exit 99 ;;\nesac\n',
        { mode: 0o700 }
      )
      const script =
        step(
          database,
          "Recheck qualification and the unchanged live alias before database writes"
        ) + '\ntouch "$RUNNER_TEMP/mutated"\n'
      const result = spawnSync(
        "/bin/bash",
        ["-e", "-o", "pipefail", "-c", script],
        {
          env: {
            ...process.env,
            PATH: `${root}:${process.env.PATH}`,
            RUNNER_TEMP: root,
            MODE: mode,
            LIVE_FIXTURE: join(root, "live.json"),
          },
          encoding: "utf8",
        }
      )
      assert.equal(result.status, mode === "valid" ? 0 : 1, result.stderr)
      assert.equal(existsSync(join(root, "mutated")), mode === "valid")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test("actual promotion step fails before Vercel promote when the baseline alias changes", () => {
  const root = mkdtempSync(join(tmpdir(), "release-promote-guard-"))
  try {
    mkdirSync(join(root, "release-ledger"))
    const revision = "a".repeat(40)
    const baseline = {
      revision: "b".repeat(40),
      deploymentId: "dpl_old",
      observedAt: "earlier",
    }
    writeFileSync(
      join(root, "release-ledger/baseline.json"),
      JSON.stringify(baseline)
    )
    writeFileSync(join(root, "release-ledger/identity.json"), "{}")
    writeFileSync(join(root, "release-ledger/staged-probes.json"), "{}")
    writeFileSync(
      join(root, "live.json"),
      JSON.stringify({
        ...baseline,
        deploymentId: "dpl_outsideRelease",
        observedAt: "later",
      })
    )
    writeFileSync(
      join(root, "metadata.json"),
      JSON.stringify({
        id: "dpl_candidate",
        projectId: "prj_example",
        ownerId: "team_example",
        url: "candidate-example.vercel.app",
        meta: { githubCommitSha: revision },
        target: "production",
        readyState: "READY",
      })
    )
    writeFileSync(
      join(root, "node"),
      '#!/bin/sh\ncase "$1" in\n *stage-ledger.mjs) exit 0 ;;\n *deployed-baseline.mjs) cp "$LIVE_FIXTURE" "$2" ;;\n *) exec "$REAL_NODE" "$@" ;;\nesac\n',
      { mode: 0o700 }
    )
    writeFileSync(
      join(root, "pnpm"),
      '#!/bin/sh\ncase "$3" in\n api) cat "$METADATA_FIXTURE" ;;\n promote) touch "$RUNNER_TEMP/promoted" ;;\n *) exit 99 ;;\nesac\n',
      { mode: 0o700 }
    )
    const result = spawnSync(
      "/bin/bash",
      [
        "-e",
        "-o",
        "pipefail",
        "-c",
        step(deployment, "Promote the verified staged deployment"),
      ],
      {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          RUNNER_TEMP: root,
          REAL_NODE: process.execPath,
          LIVE_FIXTURE: join(root, "live.json"),
          METADATA_FIXTURE: join(root, "metadata.json"),
          EXPECTED_REVISION: revision,
          DEPLOYMENT_URL: "https://candidate-example.vercel.app",
          CANONICAL_VERCEL_PROJECT_ID: "prj_example",
          CANONICAL_VERCEL_TEAM_ID: "team_example",
        },
        encoding: "utf8",
      }
    )
    assert.equal(result.status, 1, result.stderr)
    assert.equal(existsSync(join(root, "promoted")), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
