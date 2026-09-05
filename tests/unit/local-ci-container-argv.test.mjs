import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  ContainerError,
  DAEMON_NETWORK_ALIAS,
  DAEMON_TCP_PORT,
  assertNoDaemonSocket,
  buildContainerArgv,
  buildDaemonArgv,
  containerTimeoutMs,
  dockerPrefix,
  jobContainerName,
} from "../../ops/local-ci/agent/container.mjs"

/**
 * local CI — the shape of a job container's `docker run`.
 *
 * The argv is a security boundary, not a configuration detail, so the builder
 * proves three things about the finished array every time it runs: the host
 * daemon socket is named nowhere, no port is published, and the container that
 * executes repository code is neither privileged nor sharing one of the VM's
 * namespaces. The socket path is assembled from fragments here for the same
 * reason it is in the module: docs/operations/local-ci.md audits that plane by
 * grepping for the literal.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

const contract = loadContract(() => CONTRACT_TEXT)

const SOCKET_BASENAME = ["docker", "sock"].join(".")
const HOST_SOCKET = `/var/run/${SOCKET_BASENAME}`

const HEAD_SHA = "f".repeat(40)
const IMAGE = "ghcr.io/lapeninns/nabaperks-ci:2026-09-01"
const DAEMON_IMAGE = "docker:27.5.1-dind"

const argv = (overrides = {}) =>
  buildContainerArgv({
    contract,
    image: IMAGE,
    name: jobContainerName({ headSha: HEAD_SHA, laneId: "fast" }),
    network: "nabaperks-ci-net-ffffffffffff-fast-1",
    command: ["bash", "-lc", "pnpm test:unit"],
    workspaceHostPath: "/home/ci/work/nabaperks",
    vm: contract.vm.name,
    ...overrides,
  })

/** The value following `flag`, for the space-separated form the builder emits. */
const valueAfter = (list, flag) => list[list.indexOf(flag) + 1]

test("container argv: the host Docker daemon socket is named nowhere", () => {
  const built = argv()
  const joined = built.join(" ")
  for (const fragment of [
    SOCKET_BASENAME,
    HOST_SOCKET,
    `/run/${SOCKET_BASENAME}`,
  ]) {
    assert.equal(
      joined.includes(fragment),
      false,
      `the job argv must not name ${fragment}`
    )
  }
  assert.equal(built.includes("--volume"), true)
  assert.equal(
    valueAfter(built, "--volume"),
    `/home/ci/work/nabaperks:${contract.container.workspacePath}`
  )
  // The lane reaches a daemon over TCP on its own private network instead.
  assert.ok(
    built.includes(
      `DOCKER_HOST=tcp://${DAEMON_NETWORK_ALIAS}:${DAEMON_TCP_PORT}`
    )
  )
})

test("container argv: a command that names the socket is refused, not passed through", () => {
  assert.throws(
    () =>
      argv({ command: ["bash", "-lc", `docker -H unix://${HOST_SOCKET} ps`] }),
    (error) => {
      assert.ok(error instanceof ContainerError)
      assert.equal(error.code, "HOST_DOCKER_SOCKET_MOUNTED")
      return true
    }
  )
  assert.throws(
    () => assertNoDaemonSocket(["--volume", `${HOST_SOCKET}:${HOST_SOCKET}`]),
    (error) => error.code === "HOST_DOCKER_SOCKET_MOUNTED"
  )
  assert.deepEqual(assertNoDaemonSocket(["docker", "run", "--rm"]), [
    "docker",
    "run",
    "--rm",
  ])
})

test("container argv: a contract that permits the socket mount cannot build an argv at all", () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  const permissive = {
    ...raw,
    container: { ...raw.container, mountHostDockerSocket: true },
  }
  assert.throws(
    () =>
      buildContainerArgv({
        ...{ contract: permissive },
        image: IMAGE,
        name: "n",
        network: "net",
        command: ["true"],
        workspaceHostPath: "/w",
      }),
    (error) => error.code === "HOST_DOCKER_SOCKET_MOUNTED"
  )
})

test("container argv: it carries the cpu, memory and timeout limits from the contract", () => {
  const built = argv()
  assert.equal(valueAfter(built, "--cpus"), String(contract.container.cpus))
  assert.equal(valueAfter(built, "--memory"), `${contract.container.memoryGb}g`)
  assert.equal(
    valueAfter(built, "--memory-swap"),
    `${contract.container.memoryGb}g`,
    "equal to --memory disables swap: a lane over budget fails fast"
  )
  assert.equal(valueAfter(built, "--workdir"), contract.container.workspacePath)

  // The wall clock is enforced inside the container too, so the ceiling still
  // holds when the agent process itself has gone away.
  const seconds = Math.round(containerTimeoutMs(contract) / 1000)
  assert.equal(seconds, contract.container.timeoutMinutes * 60)
  assert.ok(built.includes("timeout"))
  assert.ok(built.includes(`${seconds}s`))
  assert.ok(built.includes("--signal=TERM"))
  assert.ok(built.includes("--pull=never"), "an image is never fetched mid-run")
  assert.ok(built.includes("--rm"))
  assert.ok(built.includes("--init"))
  assert.equal(valueAfter(built, "--security-opt"), "no-new-privileges")
})

test("container argv: the job container is never privileged and shares no host namespace", () => {
  const built = argv()
  assert.equal(built.includes("--privileged"), false)
  for (const flag of [
    "--network=host",
    "--net=host",
    "--pid=host",
    "--ipc=host",
    "--userns=host",
  ]) {
    assert.equal(built.includes(flag), false)
  }

  // Both spellings docker accepts are refused, including the space-separated
  // one every builder in that module emits.
  assert.throws(
    () => argv({ network: "host" }),
    (error) => error.code === "PRIVILEGED_JOB_CONTAINER"
  )
  assert.throws(
    () => argv({ labels: { "--ipc": "host" } }),
    (error) => error.code === "PRIVILEGED_JOB_CONTAINER"
  )
  assert.throws(
    () => argv({ labels: { "--privileged": "" } }),
    (error) => error.code === "PRIVILEGED_JOB_CONTAINER"
  )
})

test("container argv: no port is published to the VM", () => {
  const built = argv()
  for (const flag of ["-p", "-P", "--publish", "--publish-all"]) {
    assert.equal(built.includes(flag), false)
  }
  assert.throws(
    () => argv({ addHosts: ["--publish=3000:3000"] }),
    (error) => error.code === "PUBLISHED_PORT"
  )
})

test("container argv: an unpinned image is refused, including behind a registry port", () => {
  for (const image of [
    "nabaperks-ci",
    "nabaperks-ci:latest",
    "ghcr.io/lapeninns/nabaperks-ci:latest",
    "registry.example:5000/nabaperks-ci",
  ]) {
    assert.throws(
      () => argv({ image }),
      (error) => {
        assert.equal(error.code, "UNPINNED_IMAGE")
        return true
      },
      `${image} must be refused`
    )
  }
  for (const image of [
    IMAGE,
    "registry.example:5000/nabaperks-ci:2026-09-01",
    `nabaperks-ci@sha256:${"a".repeat(64)}`,
  ]) {
    assert.ok(Array.isArray(argv({ image })), `${image} is pinned`)
  }
})

test("container argv: a host-secret name in the job environment stops the build", () => {
  assert.throws(
    () =>
      argv({
        env: { CI: "1", [contract.hostSecrets[0]]: "1234567" },
      }),
    (error) => {
      assert.equal(error.code, "HOST_SECRET_LEAKED")
      assert.match(error.message, new RegExp(contract.hostSecrets[0]))
      return true
    }
  )
})

test("container argv: an env file keeps values out of the process table", () => {
  const withFile = argv({
    env: { CRON_SECRET: "Yx4Kq2Lm9Rt7Zb1Nc6Vd3Fg8Hj5Pw0Qs" },
    envFile: "/run/nabaperks-ci/fast.env",
  })
  assert.equal(valueAfter(withFile, "--env-file"), "/run/nabaperks-ci/fast.env")
  assert.equal(
    withFile.some((entry) =>
      entry.includes("Yx4Kq2Lm9Rt7Zb1Nc6Vd3Fg8Hj5Pw0Qs")
    ),
    false,
    "an argument is visible to every process on the VM through ps"
  )

  const withoutFile = argv({ env: { CI: "1" } })
  assert.ok(withoutFile.includes("CI=1"))
})

test("the sidecar daemon is the one privileged container, and it publishes nothing", () => {
  const daemon = buildDaemonArgv({
    contract,
    name: "nabaperks-ci-dind-ffffffffffff-db-1",
    network: "nabaperks-ci-net-ffffffffffff-db-1",
    image: DAEMON_IMAGE,
    vm: contract.vm.name,
  })
  assert.ok(daemon.includes("--privileged"))
  assert.equal(valueAfter(daemon, "--network-alias"), DAEMON_NETWORK_ALIAS)
  for (const flag of ["-p", "-P", "--publish", "--publish-all"]) {
    assert.equal(daemon.includes(flag), false)
  }
  assert.equal(daemon.join(" ").includes(SOCKET_BASENAME), false)
  assert.ok(daemon.includes("--detach"))
})

test("every docker command runs inside the Lima VM, never against a daemon on the Mac", () => {
  assert.deepEqual(dockerPrefix({ vm: "nabaperks-ci" }), [
    "limactl",
    "shell",
    "nabaperks-ci",
    "--",
    "docker",
  ])
  assert.deepEqual(dockerPrefix({}), ["docker"])
  assert.equal(argv()[0], "limactl")
  assert.equal(
    jobContainerName({ headSha: HEAD_SHA, laneId: "e2e-chromium" }),
    "nabaperks-ci-job-ffffffffffff-e2e-chromium-1"
  )
})
