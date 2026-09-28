import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PERMITTED_HOST_EXECUTABLES,
  createLimaRuntime,
} from "../../ops/local-ci/agent/runtime-lima.mjs"
import { limaContract } from "../support/local-ci-contracts.mjs"

/**
 * local CI - the Lima runtime behind the runtime interface.
 *
 * Its verdict and scripts moved out of main.mjs unchanged and are covered by
 * the main-cli tests through main.mjs's re-exports. What is new is the
 * interface wrapper, and what matters about it is that every host command
 * still goes through the Lima allowlist and into the VM.
 */

const contract = limaContract()
const SHA = "c".repeat(40)
const config = {
  vm: "nabaperks-ci",
  vmWorkspaceRoot: "/var/lib/nabaperks-ci",
  stateRoot: "/unused",
}

function scripted() {
  const calls = []
  const execHost = async (argv, options = {}) => {
    calls.push({ argv, options })
    if (argv[1] === "list")
      return JSON.stringify([{ name: "nabaperks-ci", status: "Running" }])
    if (argv.includes("docker stats --no-stream --format '{{json .}}'"))
      return '{"Name":"nabaperks-ci-job-x","MemUsage":"1GiB / 40GiB"}\n'
    if (argv.at(-1)?.startsWith?.("docker ps --all"))
      return "nabaperks-ci-job-x\nsomething-else\n"
    return [
      "ssh_auth_sock=[]",
      "findmnt=present",
      "host_mounts_status=ok",
      "host_mounts=",
      "host_home=absent",
      "rosetta=absent",
      "probe=ok",
    ].join("\n")
  }
  return { calls, execHost }
}

test("the Lima runtime keeps its allowlist and runs every script inside the VM", async () => {
  const { calls, execHost } = scripted()
  const logger = { info() {} }
  const runtime = createLimaRuntime({ contract, config, logger, execHost })
  assert.equal(runtime.kind, "lima")
  assert.deepEqual(PERMITTED_HOST_EXECUTABLES, ["/bin/sh", "limactl"])
  assert.deepEqual(runtime.hostedOnlyRequirements, [])
  assert.deepEqual(runtime.laneScriptPrelude, [])
  assert.deepEqual(runtime.containerRuntimeOptions(), { vm: "nabaperks-ci" })
  assert.equal(await runtime.externalMemoryGb(), 0)

  assert.deepEqual(await runtime.assertIsolationLive(), {
    vm: "nabaperks-ci",
    status: "Running",
  })
  const workspace = await runtime.prepareWorkspace({ headSha: SHA })
  assert.equal(workspace, `/var/lib/nabaperks-ci/runs/${SHA}`)
  const lane = await runtime.prepareLaneWorkspace(
    { id: "fast" },
    { workspace, headSha: SHA, timeoutMs: 1000 }
  )
  assert.equal(lane, `/var/lib/nabaperks-ci/runs/${SHA}-lanes/fast`)
  const env = await runtime.envFileWriter({ headSha: SHA })(
    { id: "fast" },
    { CI: "1" }
  )
  assert.equal(env, `/var/lib/nabaperks-ci/runs/${SHA}/.env.fast`)
  await runtime.releaseWorkspace({ headSha: SHA })
  assert.deepEqual(await runtime.ownedContainerNames(), ["nabaperks-ci-job-x"])
  assert.equal((await runtime.containerStats()).length, 1)

  for (const { argv, options } of calls) {
    assert.equal(options.permitted, PERMITTED_HOST_EXECUTABLES)
    assert.equal(argv[0], "limactl")
    if (argv[1] === "shell")
      assert.deepEqual(argv.slice(0, 4), [
        "limactl",
        "shell",
        "nabaperks-ci",
        "--",
      ])
  }
  assert.ok(calls.some(({ options }) => options.input === "CI=1\n"))
})
