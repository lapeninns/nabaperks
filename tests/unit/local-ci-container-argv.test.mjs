import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  ContainerError,
  DAEMON_NETWORK_ALIAS,
  DAEMON_TCP_PORT,
  READ_ABSENT_STATUS,
  READ_NOT_A_FILE_STATUS,
  assertNoDaemonSocket,
  buildContainerArgv,
  buildDaemonArgv,
  buildNetworkCreateArgv,
  buildNetworkRemoveArgv,
  buildRemoveArgv,
  buildStopArgv,
  buildWorkspaceReadArgv,
  containerTimeoutMs,
  createContainerRuntime,
  daemonContainerName,
  dockerPrefix,
  isAgentOwnedName,
  jobContainerName,
  networkName,
} from "../../ops/local-ci/agent/container.mjs"

/**
 * local CI — the shape of a job container's `docker run`, and the lifecycle
 * around it.
 *
 * The argv is a security boundary, not a configuration detail, so the builder
 * proves three things about the finished array every time it runs: the host
 * daemon socket is named nowhere, no port is published, and the container that
 * executes repository code is neither privileged nor sharing one of the VM's
 * namespaces. The socket path is assembled from fragments here for the same
 * reason it is in the module: docs/operations/local-ci.md audits that plane by
 * grepping for the literal.
 *
 * The lifecycle tests at the bottom cover the other half: a docker daemon that
 * still holds the last run's leftovers, and reading a lane's log back out of
 * the workspace before the worktree is deleted. Both spawn, so both are driven
 * with a scripted `spawnFn` rather than a real docker.
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

/* ------------------------------------------------------- lifecycle: spawning */

const VM = contract.vm.name
const IDENTITY = { headSha: HEAD_SHA, laneId: "db" }
const JOB_NAME = jobContainerName(IDENTITY)
const DAEMON_NAME = daemonContainerName(IDENTITY)
const NET_NAME = networkName(IDENTITY)

/**
 * A `spawnFn` that runs nothing. `script(argv, index)` returns the exit code
 * and streams for that call; every argv is recorded in order.
 */
function scriptedSpawn(script = () => ({})) {
  const calls = []
  const spawnFn = (executable, args) => {
    const argv = [executable, ...args]
    calls.push(argv)
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => {}
    const outcome = script(argv, calls.length - 1) ?? {}
    setImmediate(() => {
      if (outcome.error) {
        child.emit("error", outcome.error)
        return
      }
      if (outcome.stdout) child.stdout.emit("data", Buffer.from(outcome.stdout))
      if (outcome.stderr) child.stderr.emit("data", Buffer.from(outcome.stderr))
      child.emit("close", outcome.code ?? 0, null)
    })
    return child
  }
  return { spawnFn, calls }
}

/** The docker sub-command of one recorded argv, e.g. "network create". */
const subCommand = (argv) => {
  const start = argv.indexOf("docker") + 1
  const words = argv.slice(start).filter((word) => !word.startsWith("-"))
  return words[0] === "network" ? `network ${words[1]}` : words[0]
}

test("a create-or-destroy argv may only name a resource this agent made", () => {
  assert.equal(isAgentOwnedName(JOB_NAME), true)
  assert.equal(isAgentOwnedName(DAEMON_NAME), true)
  assert.equal(isAgentOwnedName(NET_NAME), true)
  assert.equal(isAgentOwnedName("postgres"), false)
  assert.equal(isAgentOwnedName("bridge"), false)

  // The reconciliation below runs `docker rm --force` before it creates
  // anything. That is only safe while a name it did not mint cannot reach it.
  for (const [label, build] of Object.entries({
    "network create": buildNetworkCreateArgv,
    "network rm": buildNetworkRemoveArgv,
    stop: buildStopArgv,
    rm: buildRemoveArgv,
  })) {
    for (const name of ["postgres", "bridge", "nabaperks-web", ""]) {
      assert.throws(
        () => build({ name, vm: VM }),
        (error) => {
          assert.ok(error instanceof ContainerError)
          assert.ok(["FOREIGN_RESOURCE", "INVALID_INPUT"].includes(error.code))
          return true
        },
        `${label} must refuse ${JSON.stringify(name)}`
      )
    }
    assert.ok(Array.isArray(build({ name: JOB_NAME, vm: VM })))
  }
})

test("a lane removes its own leftovers before it creates them, and touches nothing else", async () => {
  const { spawnFn, calls } = scriptedSpawn()
  const runtime = createContainerRuntime({ contract, vm: VM, spawnFn })

  await runtime.withJobContainer({
    ...IDENTITY,
    image: IMAGE,
    daemonImage: DAEMON_IMAGE,
    command: ["bash", "-lc", "pnpm test:db"],
    workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
    env: {},
    envFile: "/run/nabaperks-ci/db.env",
    needsDaemon: true,
  })

  const sequence = calls.map(subCommand)
  const created = sequence.indexOf("network create")
  assert.ok(created > 0, "the create is not the first thing this lane does")

  // A run killed mid-lane leaves the detached sidecar and the named network
  // behind; the names are deterministic, so the restart would collide with
  // itself forever. These three are what make launchd's restart self-healing.
  assert.deepEqual(sequence.slice(0, created), ["rm", "rm", "network rm"])
  assert.deepEqual(
    calls.slice(0, created).map((argv) => argv.at(-1)),
    [JOB_NAME, DAEMON_NAME, NET_NAME]
  )

  // Every name this lane ever hands to a destructive docker command is one of
  // its own three, in the VM, and never a bare `docker` on the Mac.
  for (const argv of calls) {
    assert.equal(argv[0], "limactl")
    if (["rm", "network rm", "stop"].includes(subCommand(argv))) {
      assert.ok(
        [JOB_NAME, DAEMON_NAME, NET_NAME].includes(argv.at(-1)),
        `${argv.join(" ")} names a resource this agent did not create`
      )
    }
  }
  assert.deepEqual(sequence.slice(created), [
    "network create",
    "run",
    "run",
    "rm",
    "rm",
    "network rm",
  ])
})

test("a network that will not create stops the lane instead of blaming it", async () => {
  const { spawnFn, calls } = scriptedSpawn((argv) =>
    subCommand(argv) === "network create"
      ? {
          code: 1,
          stderr: `Error response from daemon: network with name ${NET_NAME} already exists\n`,
        }
      : {}
  )
  const runtime = createContainerRuntime({ contract, vm: VM, spawnFn })

  await assert.rejects(
    () =>
      runtime.withJobContainer({
        ...IDENTITY,
        image: IMAGE,
        daemonImage: DAEMON_IMAGE,
        command: ["bash", "-lc", "pnpm test:db"],
        workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
        env: {},
        envFile: "/run/nabaperks-ci/db.env",
      }),
    (error) => {
      assert.ok(error instanceof ContainerError)
      assert.equal(error.code, "NETWORK_UNAVAILABLE")
      // The docker error reaches the caller, so the lane's evidence says what
      // actually happened rather than reporting a lane that failed on its own.
      assert.match(error.message, /already exists/)
      return true
    }
  )
  assert.equal(
    calls.some((argv) => subCommand(argv) === "run"),
    false,
    "no container is started into a network that does not exist"
  )
})

test("reading a lane's log back out of the workspace happens in the VM and never follows a link", () => {
  const argv = buildWorkspaceReadArgv({
    workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
    name: "print-kit-preview.log",
    vm: VM,
  })
  assert.deepEqual(argv.slice(0, 5), ["limactl", "shell", VM, "--", "/bin/sh"])
  assert.equal(argv[5], "-c")

  const script = argv[6]
  assert.match(
    script,
    /\[ -L "\$part" \]/,
    "the file was written by repository code, which shares the workspace with the lane's own .env"
  )
  assert.match(script, new RegExp(`exit ${READ_NOT_A_FILE_STATUS}`))
  assert.match(script, new RegExp(`exit ${READ_ABSENT_STATUS}`))
  assert.match(
    script,
    /'\/var\/lib\/nabaperks-ci\/runs\/head\/print-kit-preview\.log'/
  )
  assert.equal(script.includes(SOCKET_BASENAME), false)

  // A declared log file name is a path inside the workspace and nothing else.
  for (const name of ["../.env.db", "sub/dir.log", "/etc/passwd"]) {
    assert.throws(
      () =>
        buildWorkspaceReadArgv({
          workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
          name,
          vm: VM,
        }),
      (error) => error.code === "INVALID_INPUT",
      `${name} must be refused`
    )
  }
})

test("a log read reports captured, absent and unreadable as three different facts", async () => {
  const read = async (outcome) => {
    const { spawnFn } = scriptedSpawn(() => outcome)
    return createContainerRuntime({
      contract,
      vm: VM,
      spawnFn,
    }).readWorkspaceLog({
      workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
      name: "print-kit-preview.log",
    })
  }

  const captured = await read({
    code: 0,
    stdout: "ready on 127.0.0.1:3000\n",
    stderr: "limactl: using the default instance\n",
  })
  assert.equal(captured.status, "captured")
  assert.equal(
    captured.text,
    "ready on 127.0.0.1:3000\n",
    "only stdout is the log; a limactl notice folded in would break the digest"
  )

  const absent = await read({ code: READ_ABSENT_STATUS })
  assert.equal(absent.status, "absent")
  assert.match(absent.reason, /no file at/)

  const linked = await read({ code: READ_NOT_A_FILE_STATUS })
  assert.equal(linked.status, "unreadable")
  assert.match(linked.reason, /symlink/)

  const broken = await read({ error: new Error("limactl: instance is down") })
  assert.equal(broken.status, "unreadable")
  assert.match(broken.reason, /instance is down/)
  // Never a throw: a log that cannot be read is a fact about the evidence, and
  // the runner has to be able to record it as one.
  assert.equal(broken.text, "")
})
