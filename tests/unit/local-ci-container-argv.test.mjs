import assert from "node:assert/strict"
import { IMAGE_CACHE_MANIFEST_SHA256 } from "../../ops/local-ci/core/image-cache.mjs"
import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { limaContract } from "../support/local-ci-contracts.mjs"
import {
  ContainerError,
  DAEMON_NETWORK_ALIAS,
  DAEMON_TCP_PORT,
  READ_ABSENT_STATUS,
  READ_NOT_A_FILE_STATUS,
  assertNoBindMounts,
  assertNoDaemonSocket,
  assertResourceBudgets,
  buildContainerArgv,
  buildMountSpec,
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
  runContainer,
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

// Everything in this file up to the Docker Desktop section exercises the Lima
// runtime, so it runs against the contract as a rollback to Lima would shape
// it. The committed contract selects Docker Desktop and is tested at the end.
const committed = loadContract(() => CONTRACT_TEXT)
const contract = limaContract()

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

test("daemon-backed jobs share only their owned sidecar network and keep DB loopback", () => {
  const daemonName = daemonContainerName({ headSha: HEAD_SHA, laneId: "db" })
  const built = argv({ daemonName })
  assert.equal(valueAfter(built, "--network"), `container:${daemonName}`)
  assert.ok(built.includes(`DOCKER_HOST=tcp://127.0.0.1:${DAEMON_TCP_PORT}`))
  assert.equal(built.includes("--add-host"), false)
  assert.equal(built.includes("--privileged"), false)
  assert.equal(built.includes("--pid"), false)
  for (const foreign of [
    "host",
    "postgres",
    jobContainerName({ headSha: HEAD_SHA, laneId: "db" }),
  ]) {
    assert.throws(() => argv({ daemonName: foreign }), {
      code: "FOREIGN_RESOURCE",
    })
  }
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
    "exec",
    "run",
    "rm",
    "rm",
    "network rm",
    "ps",
    "network ls",
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

test("a missing daemon image fails before repository code starts and still cleans up", async () => {
  const { spawnFn, calls } = scriptedSpawn((argv) =>
    subCommand(argv) === "run" && argv.includes("--detach")
      ? { code: 125, stderr: `No such image: ${DAEMON_IMAGE}\n` }
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
        needsDaemon: true,
      }),
    (error) => {
      assert.equal(error.code, "DAEMON_UNAVAILABLE")
      assert.match(error.message, /No such image/)
      return true
    }
  )
  assert.equal(calls.filter((argv) => subCommand(argv) === "run").length, 1)
  assert.deepEqual(calls.slice(-5, -2).map(subCommand), [
    "rm",
    "rm",
    "network rm",
  ])
})

test("a daemon that never becomes ready cannot start repository code", async () => {
  const { spawnFn, calls } = scriptedSpawn((argv) =>
    subCommand(argv) === "exec"
      ? { code: 1, stderr: "Cannot connect to the Docker daemon\n" }
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
        needsDaemon: true,
      }),
    (error) => {
      assert.equal(error.code, "DAEMON_UNAVAILABLE")
      assert.match(error.message, /did not become ready.*Cannot connect/)
      return true
    }
  )
  assert.equal(calls.filter((argv) => subCommand(argv) === "run").length, 1)
  assert.deepEqual(calls.slice(-5, -2).map(subCommand), [
    "rm",
    "rm",
    "network rm",
  ])
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

/** A spawn that emits exactly the given stdout chunks, then exits zero. */
function spawnEmitting(chunks) {
  return () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.pid = 4242
    setImmediate(() => {
      for (const chunk of chunks) child.stdout.emit("data", chunk)
      child.emit("close", 0, null)
    })
    return child
  }
}

test("the capture keeps the process's bytes, across chunk boundaries and through invalid UTF-8", async () => {
  // `A£B`, with the two bytes of `£` arriving in different chunks. Decoding
  // per chunk turned this perfectly valid log into `A<U+FFFD><U+FFFD>B`.
  const valid = Buffer.from("A£B", "utf8")
  assert.equal(valid.toString("hex"), "41c2a342")
  const streamed = []
  const split = await runContainer(["fixture"], {
    spawnFn: spawnEmitting([valid.subarray(0, 2), valid.subarray(2)]),
    onOutput: (chunk) => streamed.push(chunk),
  })
  assert.deepEqual(
    split.outputBytes,
    valid,
    "a multi-byte sequence split across two chunks must survive the capture"
  )
  assert.equal(split.output, "A£B", "and still decode to the log it was")
  assert.ok(
    streamed.every((chunk) => Buffer.isBuffer(chunk)),
    "onOutput streams bytes, so the log file receives what the process wrote"
  )
  assert.deepEqual(Buffer.concat(streamed), valid)

  // The two logs the digest has to be able to tell apart. Neither is valid
  // UTF-8, and decoding folds both to `A<U+FFFD>B`.
  const first = await runContainer(["fixture"], {
    spawnFn: spawnEmitting([Buffer.from([0x41, 0x80, 0x42])]),
  })
  const second = await runContainer(["fixture"], {
    spawnFn: spawnEmitting([Buffer.from([0x41, 0xff, 0x42])]),
  })
  assert.equal(
    first.output,
    second.output,
    "the text view cannot separate them"
  )
  assert.notDeepEqual(
    first.outputBytes,
    second.outputBytes,
    "the capture must, because the digest is taken over it"
  )
  assert.equal(first.outputBytes.toString("hex"), "418042")
  assert.equal(second.outputBytes.toString("hex"), "41ff42")
})

test("an already-cancelled process never spawns", async () => {
  const result = await runContainer(
    ["limactl", "shell", "ci", "--", "docker", "run", "fixture"],
    {
      signal: AbortSignal.abort(new Error("stopped before spawn")),
      spawnFn: () => assert.fail("already-cancelled work must not spawn"),
    }
  )
  assert.equal(result.cancelled, true)
  assert.equal(result.timedOut, false)
})

test("cancellation closes descendant output pipes before container cleanup", async () => {
  const controller = new AbortController()
  const started = Date.now()
  let terminationRequests = 0
  const result = await runContainer(
    [
      process.execPath,
      "-e",
      `
      const child = require('node:child_process').spawn(process.execPath,
        ['-e', 'console.log("descendant-ready"); setTimeout(() => {}, 6000)'],
        {stdio: 'inherit'});
      setTimeout(() => {}, 10000);
    `,
    ],
    {
      signal: controller.signal,
      onTerminate: () => {
        terminationRequests += 1
      },
      onOutput: (output) => {
        if (output.includes("descendant-ready")) controller.abort()
      },
    }
  )
  assert.equal(controller.signal.aborted, true)
  assert.equal(result.cancelled, true)
  assert.equal(
    terminationRequests,
    1,
    "the lifecycle owner must stop its remote job"
  )
  assert.ok(
    Date.now() - started < 3000,
    "descendant must not hold the output pipe open"
  )
})

test("resource budgets: sidecar CPU and memory are bounded with swap disabled", () => {
  const daemon = buildDaemonArgv({
    contract,
    name: "nabaperks-ci-dind-ffffffffffff-db-1",
    network: "nabaperks-ci-net-ffffffffffff-db-1",
    image: DAEMON_IMAGE,
  })
  assert.equal(
    valueAfter(daemon, "--cpus"),
    String(contract.container.daemon.cpus)
  )
  assert.equal(
    valueAfter(daemon, "--memory"),
    `${contract.container.daemon.memoryGb}g`
  )
  assert.equal(
    valueAfter(daemon, "--memory-swap"),
    valueAfter(daemon, "--memory")
  )
  assertResourceBudgets(contract)
})

test("a parallel lane receives its admitted cgroup budget with no extra swap", () => {
  const built = argv({ resources: { cpus: 2, memoryGb: 8 } })
  assert.equal(valueAfter(built, "--cpus"), "2")
  assert.equal(valueAfter(built, "--memory"), "8g")
  assert.equal(valueAfter(built, "--memory-swap"), "8g")
  assert.throws(() => argv({ resources: { cpus: 11, memoryGb: 8 } }))
})

test("successful commands cannot hide leaked containers or unverifiable teardown", async () => {
  for (const response of [{ stdout: `${JOB_NAME}\n` }, { code: 1 }]) {
    const { spawnFn } = scriptedSpawn((args) =>
      subCommand(args) === "ps" ? response : {}
    )
    const runtime = createContainerRuntime({ contract, vm: VM, spawnFn })
    const result = await runtime.withJobContainer({
      ...IDENTITY,
      image: IMAGE,
      daemonImage: DAEMON_IMAGE,
      command: ["true"],
      workspaceHostPath: "/workspace",
      env: {},
    })
    assert.equal(result.exitCode, 0)
    assert.ok(result.teardownErrors.length > 0)
  }
})

test("resource budgets: every budget rejects nonnumeric, nonfinite and nonpositive values", () => {
  for (const path of [
    ["container", "cpus"],
    ["container", "memoryGb"],
    ["container", "daemon", "cpus"],
    ["container", "daemon", "memoryGb"],
    ["vm", "cpus"],
    ["vm", "memoryGb"],
    ["vm", "reserveCpus"],
    ["vm", "reserveMemoryGb"],
  ]) {
    for (const invalid of [undefined, null, "2", 0, -1, NaN, Infinity]) {
      const modified = structuredClone(contract)
      const owner = path
        .slice(0, -1)
        .reduce((object, key) => object[key], modified)
      owner[path.at(-1)] = invalid
      assert.throws(() => argv({ contract: modified }), {
        code: "INVALID_RESOURCE_BUDGET",
      })
      assert.throws(() => buildDaemonArgv({ contract: modified }), {
        code: "INVALID_RESOURCE_BUDGET",
      })
    }
  }
})

test("resource budgets: either container refuses CPU or memory overcommit including VM reserve", () => {
  for (const field of ["cpus", "memoryGb"]) {
    const modified = structuredClone(contract)
    modified.container.daemon[field] += 0.25
    assert.throws(() => argv({ contract: modified }), {
      code: "RESOURCE_OVERCOMMIT",
    })
    assert.throws(() => buildDaemonArgv({ contract: modified }), {
      code: "RESOURCE_OVERCOMMIT",
    })
    assert.throws(() => createContainerRuntime({ contract: modified }), {
      code: "RESOURCE_OVERCOMMIT",
    })
  }
})

test("a failed image preload prevents repository code and still removes the sidecar", async () => {
  const { spawnFn, calls } = scriptedSpawn((argv) =>
    argv.includes("image-cache-load")
      ? { code: 1, stderr: "archive rejected" }
      : {}
  )
  const runtime = createContainerRuntime({
    contract,
    vm: VM,
    spawnFn,
    imageCachePin: {
      archiveSha256: "a".repeat(64),
      manifestSha256: IMAGE_CACHE_MANIFEST_SHA256,
    },
  })
  await assert.rejects(
    () =>
      runtime.withJobContainer({
        ...IDENTITY,
        image: IMAGE,
        daemonImage: DAEMON_IMAGE,
        command: ["bash", "-lc", "pnpm test:db"],
        workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
        env: {},
        needsDaemon: true,
      }),
    { code: "IMAGE_CACHE_UNAVAILABLE" }
  )
  assert.equal(
    calls.some((argv) => argv.includes(IMAGE)),
    false
  )
  assert.ok(calls.some((argv) => argv.includes("image-cache-load")))
  assert.deepEqual(calls.slice(-5, -2).map(subCommand), [
    "rm",
    "rm",
    "network rm",
  ])
})

test("only a daemon-backed lane loads images, and it loads before repository code", async () => {
  for (const needsDaemon of [true, false]) {
    const { spawnFn, calls } = scriptedSpawn()
    const runtime = createContainerRuntime({
      contract,
      vm: VM,
      spawnFn,
      imageCachePin: {
        archiveSha256: "a".repeat(64),
        manifestSha256: IMAGE_CACHE_MANIFEST_SHA256,
      },
    })
    await runtime.withJobContainer({
      ...IDENTITY,
      image: IMAGE,
      daemonImage: DAEMON_IMAGE,
      command: ["bash", "-lc", "pnpm test"],
      workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
      env: {},
      needsDaemon,
    })
    const loaded = calls.findIndex((argv) => argv.includes("image-cache-load"))
    const ran = calls.findIndex((argv) => argv.includes(IMAGE))
    assert.ok(ran >= 0)
    if (needsDaemon) assert.ok(loaded >= 0 && loaded < ran)
    else assert.equal(loaded, -1)
  }
})

test("cancelling an image preload prevents repository commands and cleans only its resources", async () => {
  const controller = new AbortController()
  const { spawnFn, calls } = scriptedSpawn((argv) => {
    if (argv.includes("image-cache-load"))
      setImmediate(() => controller.abort())
    return {}
  })
  const runtime = createContainerRuntime({
    contract,
    vm: VM,
    spawnFn,
    imageCachePin: {
      archiveSha256: "a".repeat(64),
      manifestSha256: IMAGE_CACHE_MANIFEST_SHA256,
    },
  })
  await assert.rejects(
    () =>
      runtime.withJobContainer({
        ...IDENTITY,
        image: IMAGE,
        daemonImage: DAEMON_IMAGE,
        command: ["bash", "-lc", "pnpm test:db"],
        workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
        env: {},
        needsDaemon: true,
        signal: controller.signal,
      }),
    { name: "AbortError" }
  )
  assert.equal(
    calls.some((argv) => argv.includes(IMAGE)),
    false
  )
  assert.deepEqual(
    calls.slice(-5, -2).map((argv) => argv.at(-1)),
    [JOB_NAME, DAEMON_NAME, NET_NAME]
  )
})

test("image preload time consumes the lane budget before repository commands", async (t) => {
  let now = 1000
  t.mock.method(Date, "now", () => now)
  const { spawnFn, calls } = scriptedSpawn((argv) => {
    if (argv.includes("image-cache-load")) now += 10001
    return {}
  })
  const runtime = createContainerRuntime({
    contract,
    vm: VM,
    spawnFn,
    imageCachePin: {
      archiveSha256: "a".repeat(64),
      manifestSha256: IMAGE_CACHE_MANIFEST_SHA256,
    },
  })
  await assert.rejects(
    () =>
      runtime.withJobContainer({
        ...IDENTITY,
        image: IMAGE,
        daemonImage: DAEMON_IMAGE,
        command: ["bash", "-lc", "pnpm test:db"],
        workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
        env: {},
        needsDaemon: true,
        timeoutMs: 10000,
      }),
    { code: "IMAGE_CACHE_TIMEOUT" }
  )
  assert.equal(
    calls.some((argv) => argv.includes(IMAGE)),
    false
  )
  assert.deepEqual(
    calls.slice(-5, -2).map((argv) => argv.at(-1)),
    [JOB_NAME, DAEMON_NAME, NET_NAME]
  )
})

/* --------------------------------------------- the Docker Desktop runtime */

const DD_SHA = "a".repeat(40)
const DD_LANE_PATH = `/var/lib/nabaperks-ci/runs/${DD_SHA}-lanes/fast`
const DD_OPTIONS = Object.freeze({
  context: "desktop-linux",
  workspaceMount: {
    type: "volume",
    source: "nabaperks-ci-state",
    subpath: `runs/${DD_SHA}-lanes/fast`,
  },
  extraMounts: [
    {
      type: "volume",
      source: "nabaperks-ci-state",
      target: "/var/lib/nabaperks-ci/stores/pnpm",
      subpath: `runs/${DD_SHA}-store/pnpm`,
      readonly: true,
    },
    { type: "tmpfs", target: "/var/lib/nabaperks-ci/stores/pnpm/v10/projects" },
  ],
  forbidBindMounts: true,
  addHosts: [],
})

const ddArgv = (overrides = {}) =>
  buildContainerArgv({
    contract: committed,
    image: IMAGE,
    name: jobContainerName({ headSha: DD_SHA, laneId: "fast" }),
    network: `nabaperks-ci-net-${DD_SHA.slice(0, 12)}-fast-1`,
    command: ["bash", "-lc", "pnpm test:unit"],
    workspaceHostPath: DD_LANE_PATH,
    docker: "/usr/local/bin/docker",
    ...DD_OPTIONS,
    ...overrides,
  })

test("every Docker Desktop command names its context, so a context switch cannot redirect it", () => {
  assert.deepEqual(
    dockerPrefix({ docker: "/usr/local/bin/docker", context: "desktop-linux" }),
    ["/usr/local/bin/docker", "--context", "desktop-linux"]
  )
  assert.deepEqual(dockerPrefix({ vm: "nabaperks-ci" }).at(-1), "docker")
  const built = ddArgv()
  assert.deepEqual(built.slice(0, 4), [
    "/usr/local/bin/docker",
    "--context",
    "desktop-linux",
    "run",
  ])
  assert.equal(
    buildRemoveArgv({ name: JOB_NAME, context: "desktop-linux" })[2],
    "desktop-linux"
  )
})

test("a Docker Desktop job network is internal and drawn from the reserved pool", () => {
  const created = buildNetworkCreateArgv({
    name: NET_NAME,
    context: "desktop-linux",
    internal: true,
    subnet: "10.213.16.0/24",
  })
  assert.ok(created.includes("--internal"))
  assert.equal(valueAfter(created, "--subnet"), "10.213.16.0/24")
  assert.equal(
    buildNetworkCreateArgv({ name: NET_NAME }).includes("--internal"),
    false
  )
  for (const subnet of ["10.213.16.0", "10.213.16.0/8", "not-a-cidr"]) {
    assert.throws(
      () => buildNetworkCreateArgv({ name: NET_NAME, subnet }),
      ContainerError
    )
  }
})

test("a Docker Desktop job mounts only its lane directory and its run's store, never a Mac path", () => {
  const built = ddArgv()
  assert.equal(built.includes("--volume"), false)
  const mounts = built.flatMap((word, index) =>
    word === "--mount" ? [built[index + 1]] : []
  )
  assert.deepEqual(mounts, [
    `type=volume,src=nabaperks-ci-state,dst=/workspace,volume-subpath=runs/${DD_SHA}-lanes/fast`,
    `type=volume,src=nabaperks-ci-state,dst=/var/lib/nabaperks-ci/stores/pnpm,volume-subpath=runs/${DD_SHA}-store/pnpm,readonly`,
    "type=tmpfs,dst=/var/lib/nabaperks-ci/stores/pnpm/v10/projects",
  ])
  assert.equal(built.includes("--add-host"), false)
  assert.equal(ddArgv({ mode: "create" })[3], "create")
  assert.throws(() => ddArgv({ mode: "exec" }), { code: "INVALID_INPUT" })
  // Without a volume mount the workspace would be a bind, which is refused.
  assert.throws(() => ddArgv({ workspaceMount: null }), {
    code: "BIND_MOUNT_REFUSED",
  })
})

test("the bind-mount proof refuses every spelling of a host path", () => {
  assert.doesNotThrow(() =>
    assertNoBindMounts([
      "docker",
      "run",
      "--mount",
      "type=volume,src=v,dst=/w",
      "--mount=type=tmpfs,dst=/t",
    ])
  )
  for (const argv of [
    ["docker", "run", "-v", "/Users:/u"],
    ["docker", "run", "-v/Users:/u"],
    ["docker", "run", "--volume", "named:/w"],
    ["docker", "run", "--volume=/:/host"],
    ["docker", "run", "--volumes-from", "other"],
    ["docker", "run", "--mount", "type=bind,src=/Users,dst=/u"],
    ["docker", "run", "--mount", "src=/Users,dst=/u"],
    ["docker", "run", "--mount=type=volume,src=/Users,dst=/u"],
  ]) {
    assert.throws(
      () => assertNoBindMounts(argv, "probe"),
      { code: "BIND_MOUNT_REFUSED" },
      argv.join(" ")
    )
  }
})

test("a mount spec accepts only plain relative subpaths into a named volume", () => {
  assert.equal(
    buildMountSpec({
      type: "volume",
      source: "nabaperks-ci-state",
      target: "/w",
      subpath: "runs/x-lanes/fast",
      readonly: true,
    }),
    "type=volume,src=nabaperks-ci-state,dst=/w,volume-subpath=runs/x-lanes/fast,readonly"
  )
  for (const mount of [
    { type: "bind", source: "/Users", target: "/u" },
    { type: "volume", source: "/Users", target: "/u" },
    { type: "volume", source: "v", target: "/u", subpath: "../other" },
    { type: "volume", source: "v", target: "/u", subpath: "/abs" },
    { type: "volume", source: "v", target: "/u", subpath: "a,readonly=false" },
    { type: "volume", source: "v", target: "relative" },
    { type: "tmpfs", target: "/t=x" },
  ]) {
    assert.throws(() => buildMountSpec(mount), ContainerError)
  }
})

test("the Docker Desktop runtime never builds a privileged sidecar", () => {
  assert.throws(
    () =>
      buildDaemonArgv({
        contract,
        name: DAEMON_NAME,
        network: NET_NAME,
        image: DAEMON_IMAGE,
        allowPrivileged: false,
      }),
    { code: "PRIVILEGED_CONTAINER_REFUSED" }
  )
  // The committed contract turns Docker-in-Docker off for this runtime too.
  assert.throws(
    () =>
      buildDaemonArgv({
        contract: committed,
        name: DAEMON_NAME,
        network: NET_NAME,
        image: DAEMON_IMAGE,
      }),
    { code: "DIND_DISABLED" }
  )
})

test("a job container is refused added capabilities, host devices and unconfined profiles", () => {
  // The proofs run over the finished array, so a flag is caught wherever in
  // it a future edit would put it; the command slot is the one input here
  // that can carry arbitrary words.
  for (const addition of [
    ["--cap-add", "SYS_ADMIN"],
    ["--cap-add=NET_ADMIN"],
    ["--device", "/dev/kvm"],
    ["--security-opt", "seccomp=unconfined"],
    ["--security-opt=apparmor=unconfined"],
  ]) {
    assert.throws(
      () => ddArgv({ command: [...addition, "true"] }),
      { code: "PRIVILEGED_JOB_CONTAINER" },
      addition.join(" ")
    )
  }
  assert.doesNotThrow(() => ddArgv({ command: ["bash", "-lc", "true"] }))
})

test("the Docker Desktop budget leaves Desktop's reserve and the external-memory floor", () => {
  assert.doesNotThrow(() => assertResourceBudgets(committed))
  for (const [field, delta] of [
    ["reserveMemoryGb", 1],
    ["externalMemoryFloorGb", 1],
    ["reserveCpus", 1],
  ]) {
    const modified = structuredClone(committed)
    modified.runtime[field] += delta
    assert.throws(() => assertResourceBudgets(modified), {
      code: "RESOURCE_OVERCOMMIT",
    })
  }
  const invalid = structuredClone(committed)
  invalid.runtime.memoryGb = Number.NaN
  assert.throws(() => assertResourceBudgets(invalid), {
    code: "INVALID_RESOURCE_BUDGET",
  })
})

test("a Docker Desktop job is created, inspected, and started only after the inspection passes", async () => {
  const spawned = []
  const spawnFn = (executable, args, options) => {
    const argv = [executable, ...args]
    spawned.push({ argv, env: options.env })
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => {}
    setImmediate(() => child.emit("close", 0, null))
    return child
  }
  const allocations = []
  const inspected = []
  for (const verdict of ["pass", "refuse"]) {
    spawned.length = 0
    const runtime = createContainerRuntime({
      contract: committed,
      docker: "/usr/local/bin/docker",
      context: "desktop-linux",
      env: { DOCKER_CONFIG: "/opt/nabaperks-local-ci/docker-config" },
      spawnFn,
      allowPrivilegedDaemon: false,
      forbidBindMounts: true,
      addHosts: [],
      roleLabel: "com.nabaperks.local-ci.role",
      extraLabels: { "nabaperks-ci-dev": "1" },
      jobNetwork: {
        internal: true,
        allocateSubnet: () => {
          allocations.push("take")
          return "10.213.16.0/24"
        },
        releaseSubnet: (subnet) => allocations.push(`release ${subnet}`),
      },
      workspaceMountFor: () => DD_OPTIONS.workspaceMount,
      extraMountsFor: () => DD_OPTIONS.extraMounts,
      inspectJobContainer: async (details) => {
        inspected.push(details)
        if (verdict === "refuse")
          throw new ContainerError("VM_ISOLATION_VIOLATION", "refused")
      },
    })
    const run = runtime.withJobContainer({
      headSha: DD_SHA,
      laneId: "fast",
      image: IMAGE,
      command: ["bash", "-lc", "true"],
      workspaceHostPath: DD_LANE_PATH,
      env: {},
      envFile: "/tmp/fast.env",
      labels: { "com.nabaperks.local-ci.head-sha": DD_SHA },
    })
    if (verdict === "refuse") {
      await assert.rejects(run, { code: "VM_ISOLATION_VIOLATION" })
      assert.equal(
        spawned.some(({ argv }) => argv.includes("start")),
        false,
        "a refused container is never started"
      )
    } else {
      assert.equal((await run).exitCode, 0)
      const create = spawned.find(({ argv }) => argv[3] === "create")
      const start = spawned.findIndex(({ argv }) => argv[3] === "start")
      assert.ok(create, "the job is created first")
      assert.ok(start > spawned.indexOf(create))
      assert.deepEqual(spawned[start].argv.slice(3), [
        "start",
        "--attach",
        jobContainerName({ headSha: DD_SHA, laneId: "fast" }),
      ])
      const network = spawned.find(
        ({ argv }) => argv[3] === "network" && argv[4] === "create"
      )
      assert.ok(network.argv.includes("--internal"))
      assert.equal(valueAfter(network.argv, "--subnet"), "10.213.16.0/24")
      assert.ok(
        network.argv.includes("com.nabaperks.local-ci.role=net") &&
          create.argv.includes("com.nabaperks.local-ci.role=job") &&
          create.argv.includes("nabaperks-ci-dev=1")
      )
      for (const { argv, env } of spawned) {
        assert.deepEqual(argv.slice(0, 3), [
          "/usr/local/bin/docker",
          "--context",
          "desktop-linux",
        ])
        assert.equal(env.DOCKER_CONFIG, "/opt/nabaperks-local-ci/docker-config")
      }
    }
  }
  assert.equal(inspected.length, 2)
  assert.equal(inspected[0].subnet, "10.213.16.0/24")
  assert.deepEqual(allocations, [
    "take",
    "release 10.213.16.0/24",
    "take",
    "release 10.213.16.0/24",
  ])
})

test("a Docker Desktop log read runs the same script in the helper the runtime supplies", async () => {
  const { spawnFn, calls } = scriptedSpawn(() => ({ stdout: "log bytes" }))
  const shells = []
  const runtime = createContainerRuntime({
    contract: committed,
    docker: "/usr/local/bin/docker",
    context: "desktop-linux",
    spawnFn,
    workspaceShellArgv: (script, { workspaceHostPath }) => {
      shells.push({ script, workspaceHostPath })
      return [
        "/usr/local/bin/docker",
        "--context",
        "desktop-linux",
        "run",
        "helper",
        "-c",
        script,
      ]
    },
  })
  const read = await runtime.readWorkspaceLog({
    workspaceHostPath: DD_LANE_PATH,
    name: "service.log",
  })
  assert.equal(read.status, "captured")
  assert.equal(read.text, "log bytes")
  assert.equal(shells[0].workspaceHostPath, DD_LANE_PATH)
  assert.match(shells[0].script, /if \[ -L "\$part" \]/)
  assert.equal(calls[0][0], "/usr/local/bin/docker")
})
