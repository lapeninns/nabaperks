/**
 * The Lima runtime: the dedicated `nabaperks-ci` VM, with `mounts: []`.
 *
 * Dormant since the move to Docker Desktop and kept as the rollback path
 * ("pause, do not retire", #297): setting `contract.runtime.kind` to `lima`
 * selects it again. The code below moved here from main.mjs unchanged; the
 * only difference is that `execHost` is handed in instead of imported, so the
 * two runtimes share one host-command allowlist mechanism without a cycle.
 */

import {
  LocalCiError,
  describeValue,
  quoteForMessage,
} from "../core/contract.mjs"
import { reconcileAgentResources } from "./recovery.mjs"
import {
  buildLaneWorkspaceScript,
  buildWorkspacePreparationScript,
  shQuote,
} from "./workspace.mjs"

class CliError extends LocalCiError {}

/**
 * The executables this runtime may spawn on the host.
 *
 * Every `execHost` argv is assembled from data that starts at the command line
 * - a head SHA, a profile name, the VM name - so leaving `argv[0]` free lets a
 * crafted invocation choose which binary runs *outside* the container, next to
 * the GitHub App private key. `git`, `docker` and `curl` run *inside* the VM,
 * as words in a script that `limactl shell` interprets. Entries are matched
 * whole: a basename match would accept `/tmp/x/limactl`.
 */
export const PERMITTED_HOST_EXECUTABLES = Object.freeze(["/bin/sh", "limactl"])

const vmShell = (vm, script) =>
  vm === null
    ? ["/bin/sh", "-c", script]
    : ["limactl", "shell", vm, "--", "/bin/sh", "-c", script]

/* ------------------------------------------------------- the VM self-check */

/**
 * The last line of the guest probe, and the proof that all of it ran.
 *
 * Without a terminator, a probe that died halfway - the VM stopped, the SSH
 * transport dropped, `limactl shell` printed a warning and exited 0 - would
 * present as "every isolation property is absent", which reads exactly like
 * "every isolation property is satisfied". The marker turns a truncated probe
 * into a refusal instead of a silent pass.
 */
export const VM_PROBE_MARKER = "probe=ok"

/**
 * What the guest is asked about itself before every dispatch.
 *
 * These are live facts, not declared ones. `~/.lima/<name>/lima.yaml` says
 * what the instance was created from; `findmnt` says what is mounted right
 * now, and a host directory mounted into a running VM by hand is invisible to
 * the former and obvious to the latter. Each line is `key=value` so the
 * parsing is a pure function of text.
 */
export const VM_PROBE_SCRIPT = [
  "set -u",
  'printf "ssh_auth_sock=[%s]\\n" "${SSH_AUTH_SOCK:-}"',
  // `findmnt` answering "nothing is mounted" and `findmnt` not being installed
  // both used to print an empty host_mounts, and the caller reads empty as
  // "clean". That is fail-open on the one probe that decides whether this VM
  // may receive pull-request code: deleting the binary would silence the
  // check. Report the tool's own availability separately so a missing or
  // failing findmnt refuses the dispatch instead of passing it.
  'if command -v findmnt >/dev/null 2>&1; then printf "findmnt=present\\n"; else printf "findmnt=absent\\n"; fi',
  'if command -v findmnt >/dev/null 2>&1; then if host_mounts="$(findmnt -rn -t virtiofs,9p,nfs,nfs4,cifs,sshfs -o TARGET)"; then printf "host_mounts_status=ok\\n"; else status=$?; if [ "$status" -eq 1 ]; then printf "host_mounts_status=ok\\n"; host_mounts=""; else printf "host_mounts_status=failed\\n"; host_mounts=""; fi; fi; else printf "host_mounts_status=unavailable\\n"; host_mounts=""; fi',
  'printf "host_mounts=%s\\n" "$(printf "%s" "${host_mounts:-}" | tr "\\n" " ")"',
  'printf "host_home=%s\\n" "$(ls -d /Users 2>/dev/null || printf absent)"',
  'printf "rosetta=%s\\n" "$(ls -d /mnt/lima-rosetta 2>/dev/null || printf absent)"',
  `printf "${VM_PROBE_MARKER}\\n"`,
].join("\n")

/**
 * `limactl list --json` as an array of instance records. Pure.
 *
 * Lima has emitted both a JSON array and newline-delimited objects across
 * versions, so both are accepted; anything else is `VM_UNVERIFIABLE` rather
 * than an empty list, because "I could not read the answer" must not resolve
 * to "there is nothing to worry about".
 */
/**
 * A Lima instance that exists but is `Stopped` is the one state the agent can
 * repair on its own: after a Mac reboot nothing restarts the VM, so without
 * this every dispatch would be refused until an operator ran
 * `limactl start` by hand — which is exactly what left a failing verdict on
 * every pull request during the first cutover week. Any other non-Running
 * state (Broken, Starting, unknown) stays a refusal, and the operator's way
 * to pause the plane is still the LaunchAgent, never the VM.
 */
export function isStoppedInstance({ vm, instances }) {
  const list = Array.isArray(instances) ? instances : []
  const instance = list.find((entry) => entry?.name === vm)
  return String(instance?.status ?? "").toLowerCase() === "stopped"
}

export function parseLimaInstances(text) {
  const trimmed = String(text ?? "").trim()
  if (trimmed === "") return []
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    const instances = []
    for (const line of trimmed.split("\n")) {
      const candidate = line.trim()
      if (candidate === "") continue
      try {
        instances.push(JSON.parse(candidate))
      } catch {
        throw new CliError(
          "VM_UNVERIFIABLE",
          `limactl list --json emitted a line that is not JSON: ${quoteForMessage(candidate.slice(0, 120))}`
        )
      }
    }
    return instances
  }
}

/** The guest probe's `key=value` lines as a record. Pure. */
export function parseVmProbe(text) {
  const report = Object.create(null)
  for (const line of String(text ?? "").split("\n")) {
    const at = line.indexOf("=")
    if (at <= 0) continue
    report[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return report
}

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0

/**
 * Refuse unless the live VM still presents the isolation this plane rests on.
 * **Pure**: it decides, it does not look.
 *
 * The VM is the entire reason it is safe to run pull-request code on a Mac
 * that holds a GitHub App private key, and "the VM was isolated when it was
 * installed" is a different claim from "the VM is isolated now". An instance
 * can be stopped and re-created, edited with `limactl edit`, or - the case no
 * configuration file records - handed a mount at run time. It can also have
 * been installed with `--skip-vm-check` and never checked at all.
 *
 * So the properties are re-derived from two live sources on every dispatch:
 * the instance record for what Lima believes it is running, and a probe inside
 * the guest for what is actually true there. Every mismatch is collected and
 * reported together, because an operator fixing one violation wants to know
 * about the other three before recreating the instance.
 */
export function assertVmIsolation({ vm, instances, probe, contract }) {
  if (typeof vm !== "string" || vm.trim() === "") {
    throw new CliError(
      "VM_NOT_CONFIGURED",
      `no Lima instance is configured, so the isolation this plane depends on cannot be asserted and pull-request code would run directly on the Mac. Set NABAPERKS_LOCAL_CI_VM or contract.vm.name (received ${describeValue(vm)}).`
    )
  }
  const list = Array.isArray(instances) ? instances : []
  const instance = list.find((entry) => entry?.name === vm)
  if (instance === undefined) {
    throw new CliError(
      "VM_NOT_FOUND",
      `limactl reports no instance named ${quoteForMessage(vm)}; create it from ${contract?.vm?.definition ?? "the committed Lima template"} before dispatching a job.`
    )
  }
  const status = String(instance.status ?? "")
  if (status.toLowerCase() !== "running") {
    throw new CliError(
      "VM_NOT_RUNNING",
      `instance ${vm} is ${quoteForMessage(status || "in an unreported state")}, not Running; start it with: limactl start ${vm}`
    )
  }

  const violations = []
  const config = instance.config ?? {}

  // Lima omits an empty list from the JSON, so only a *present, non-empty*
  // collection is evidence of a violation here. The absence of evidence is
  // covered by the guest probe below, which cannot be omitted.
  const mounts = instance.mounts ?? config.mounts
  if (isNonEmptyArray(mounts)) {
    violations.push(
      `declares ${mounts.length} host mount(s); the credential directory on the Mac must be unreachable from every job container`
    )
  }
  const networks = instance.networks ?? config.networks
  if (isNonEmptyArray(networks)) {
    violations.push(
      `declares ${networks.length} shared network(s); the template pins networks: [] so nothing inbound can reach the guest`
    )
  }
  const ssh = config.ssh ?? {}
  if (ssh.forwardAgent === true) {
    violations.push(
      "forwards an SSH agent; a job container could then authenticate as the operator"
    )
  }
  if (ssh.loadDotSSHPubKeys === true) {
    violations.push(
      "loads the operator's ~/.ssh public keys; the template pins loadDotSSHPubKeys: false"
    )
  }
  if (config.rosetta?.enabled === true) {
    violations.push(
      "enables Rosetta; the template pins rosetta.enabled: false so no x86-64 binary runs under emulation"
    )
  }

  const report = probe ?? {}
  if (report.probe !== "ok") {
    throw new CliError(
      "VM_UNVERIFIABLE",
      `the isolation probe inside ${vm} did not run to completion (expected a trailing ${VM_PROBE_MARKER} line); refusing to dispatch on an unverified VM`
    )
  }
  if (report.ssh_auth_sock !== "[]") {
    violations.push(
      `has SSH_AUTH_SOCK set to ${quoteForMessage(report.ssh_auth_sock)}; a forwarded agent socket is reachable from inside the guest`
    )
  }
  // An unanswerable mount question is a refusal, not a pass. `findmnt` being
  // absent or erroring would otherwise render an empty host_mounts that reads
  // exactly like a clean guest, which would let the strongest isolation check
  // be disabled by removing one binary.
  if (report.findmnt !== "present") {
    violations.push(
      "has no usable findmnt, so its live mount table cannot be read; the host-mount check cannot be answered and must not be assumed clean"
    )
  } else if (report.host_mounts_status !== "ok") {
    violations.push(
      `could not read its live mount table (findmnt reported ${quoteForMessage(report.host_mounts_status ?? "nothing")}); the host-mount check cannot be answered and must not be assumed clean`
    )
  } else if (report.host_mounts !== "") {
    violations.push(
      `has host filesystem mounts live right now: ${report.host_mounts.trim()}`
    )
  }
  if (report.host_home !== "absent") {
    violations.push(
      `can see ${report.host_home} inside the guest; the Mac's home directory must not be visible there`
    )
  }
  if (report.rosetta !== "absent") {
    violations.push(`has Rosetta mounted at ${report.rosetta}`)
  }

  if (violations.length > 0) {
    throw new CliError(
      "VM_ISOLATION_VIOLATION",
      `instance ${vm} no longer matches the isolation this plane depends on, so no pull-request code will be dispatched to it:\n  - ${violations.join("\n  - ")}\nDelete and recreate it from ${contract?.vm?.definition ?? "the committed Lima template"}; never patch it in place.`
    )
  }
  return Object.freeze({ vm, status })
}

/**
 * Ask the host and the guest, then decide. **Impure.**
 *
 * Any failure to *ask* is itself a refusal: a dispatch that proceeds because
 * the check could not be made has no isolation guarantee at all.
 */
export async function assertVmIsolationLive({ config, contract, execHost }) {
  const vm = config.vm
  if (typeof vm !== "string" || vm.trim() === "") {
    // Same refusal as the pure check, raised before anything is spawned.
    return assertVmIsolation({ vm, instances: [], probe: null, contract })
  }
  let listed
  let probed
  try {
    listed = await execHost(["limactl", "list", "--json", vm], {
      timeoutMs: 60_000,
    })
    if (isStoppedInstance({ vm, instances: parseLimaInstances(listed) })) {
      // Start, then list again: the isolation verdict below must come from
      // the instance as it is now running, never from the pre-start listing.
      await execHost(["limactl", "start", "--tty=false", vm], {
        timeoutMs: 600_000,
      })
      listed = await execHost(["limactl", "list", "--json", vm], {
        timeoutMs: 60_000,
      })
    }
    probed = await execHost(vmShell(vm, VM_PROBE_SCRIPT), { timeoutMs: 60_000 })
  } catch (error) {
    throw new CliError(
      "VM_UNVERIFIABLE",
      `could not re-assert the isolation of instance ${vm} (${error.message}); refusing to dispatch`
    )
  }
  const isolation = assertVmIsolation({
    vm,
    instances: parseLimaInstances(listed),
    probe: parseVmProbe(probed),
    contract,
  })
  return isolation
}

/** Full Git history stays inside the disposable /workspace container mount. */
async function prepareWorkspace({
  config,
  contract,
  headSha,
  logger,
  signal,
  execHost,
}) {
  const root = config.vmWorkspaceRoot
  const workspace = `${root}/runs/${headSha}`
  logger.info(`preparing ${workspace} inside the VM`)
  const script = buildWorkspacePreparationScript({
    root,
    remoteUrl: contract.remoteUrl,
    headSha,
  })
  await execHost(vmShell(config.vm, script), { signal })
  return workspace
}

async function releaseWorkspace({ config, headSha, execHost }) {
  const root = config.vmWorkspaceRoot
  const script = [
    "set -eu",
    `remaining=$(docker ps --all --filter ${shQuote(`label=com.nabaperks.local-ci.head-sha=${headSha}`)} --format '{{.Names}}')`,
    'if [ -n "$remaining" ]; then echo "CI resources remain; workspace quarantined" >&2; exit 1; fi',
    `cd ${shQuote(`${root}/repo`)} 2>/dev/null || exit 0`,
    `git worktree remove --force ${shQuote(`${root}/runs/${headSha}`)} 2>/dev/null || true`,
    `rm -rf ${shQuote(`${root}/runs/${headSha}`)}`,
    `rm -rf ${shQuote(`${root}/runs/${headSha}-lanes`)}`,
  ].join("\n")
  await execHost(vmShell(config.vm, script), { timeoutMs: 20_000 })
}

/**
 * Write a lane's environment to a file inside the VM at mode 0600.
 *
 * A file rather than `--env NAME=VALUE`: process arguments are readable by
 * every process on the VM through `ps`, and the runtime fixtures a lane needs
 * are not worth publishing that way even though none of them is a host secret.
 */
function makeEnvFileWriter({ config, headSha, signal, execHost }) {
  return async (lane, env) => {
    const path = `${config.vmWorkspaceRoot}/runs/${headSha}/.env.${lane.id}`
    const body = Object.entries(env)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n")
    await execHost(vmShell(config.vm, `umask 077; cat > ${shQuote(path)}`), {
      input: `${body}\n`,
      signal,
    })
    return path
  }
}

/**
 * The Lima runtime behind the interface main.mjs dispatches through.
 *
 * Lima provides every capability a lane may require - its privileged Docker
 * sidecar runs inside a VM that holds nothing of the Mac's - so nothing is
 * routed hosted-only for want of one, and no other stack shares its memory.
 */
export function createLimaRuntime({ contract, config, logger, execHost }) {
  const run = (argv, options = {}) =>
    execHost(argv, { ...options, permitted: PERMITTED_HOST_EXECUTABLES })
  return Object.freeze({
    kind: "lima",
    description: `Lima instance ${config.vm}`,
    permittedHostExecutables: PERMITTED_HOST_EXECUTABLES,
    hostedOnlyRequirements: Object.freeze([]),
    laneScriptPrelude: Object.freeze([]),
    assertIsolationLive: () =>
      assertVmIsolationLive({ config, contract, execHost: run }),
    reconcile: ({ profiles }) =>
      reconcileAgentResources({
        vm: config.vm,
        stateRoot: config.stateRoot,
        profiles,
        exec: run,
      }),
    prepareWorkspace: ({ headSha, signal }) =>
      prepareWorkspace({
        config,
        contract,
        headSha,
        logger,
        signal,
        execHost: run,
      }),
    prepareLaneWorkspace: async (lane, { workspace, headSha, ...options }) => {
      const { destination, script } = buildLaneWorkspaceScript({
        workspace,
        laneId: lane.id,
        headSha,
        remoteUrl: contract.remoteUrl,
      })
      await run(vmShell(config.vm, script), options)
      return destination
    },
    envFileWriter: ({ headSha, signal }) =>
      makeEnvFileWriter({ config, headSha, signal, execHost: run }),
    releaseWorkspace: ({ headSha }) =>
      releaseWorkspace({ config, headSha, execHost: run }),
    containerRuntimeOptions: () => ({ vm: config.vm }),
    externalMemoryGb: async () => 0,
    /** For the benchmark: the agent's containers still on the daemon. */
    ownedContainerNames: async () =>
      (
        await run(vmShell(config.vm, "docker ps --all --format '{{.Names}}'"), {
          timeoutMs: 30_000,
        })
      )
        .split(/\r?\n/)
        .filter((name) => name.startsWith("nabaperks-ci-")),
    imageId: async (image) =>
      (
        await run(
          vmShell(
            config.vm,
            `docker image inspect --format '{{.Id}}' ${shQuote(image)}`
          ),
          { timeoutMs: 30_000 }
        )
      ).trim(),
    containerStats: async () => {
      const data = await run(
        vmShell(config.vm, "docker stats --no-stream --format '{{json .}}'"),
        { timeoutMs: 15_000 }
      )
      return data.trim() ? data.trim().split(/\r?\n/).map(JSON.parse) : []
    },
  })
}
