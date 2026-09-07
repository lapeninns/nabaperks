/** Protected supervisor adapter. Never targets an existing/shared Lima instance. */
import { createHash, randomUUID } from "node:crypto"
import { spawn, execFileSync } from "node:child_process"
import {
  createReadStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  lstatSync,
  existsSync,
  realpathSync,
} from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

const CONFIG_PATH = "/opt/nabaperks-trusted-ci/lima-adapter.json"
const ROOTS = [
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
]
const sha = (value) => createHash("sha256").update(value).digest("hex")
const demand = (condition, message) => {
  if (!condition) throw new Error(message)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const binding = (value) => ({
  repository: value.repository,
  sha: value.sha,
  profile: value.profile,
  attemptId: value.attemptId,
  challenge: value.challenge,
})
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`

/** Reject user-writable binaries, inputs and ancestor aliases before use. */
export function protectedPath(path, kind = "file") {
  demand(
    isAbsolute(path) && realpathSync(path) === resolve(path),
    "Protected adapter path contains an alias"
  )
  let current = path
  while (true) {
    const info = lstatSync(current)
    demand(
      info.uid === 0 && (info.mode & 0o022) === 0 && !info.isSymbolicLink(),
      "Protected adapter path is writable outside root"
    )
    if (current === path)
      demand(
        kind === "directory" ? info.isDirectory() : info.isFile(),
        "Protected adapter input type mismatch"
      )
    if (dirname(current) === current) break
    current = dirname(current)
  }
  return path
}
async function fileDigest(path) {
  const digest = createHash("sha256")
  for await (const bytes of createReadStream(path)) digest.update(bytes)
  return `sha256:${digest.digest("hex")}`
}
const auditResult = (result, extra = {}) => ({
  schema: "nabaperks.disposable-output.v1",
  exitCode: result.exitCode,
  signal: result.signal,
  stdout: {
    encoding: "base64",
    data: Buffer.from(result.stdout ?? "").toString("base64"),
  },
  stderr: {
    encoding: "base64",
    data: Buffer.from(result.stderr ?? "").toString("base64"),
  },
  ...extra,
})
function atomicWrite(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temporary, "wx", 0o600)
  try {
    writeFileSync(fd, JSON.stringify(value))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temporary, path)
  const directory = openSync(dirname(path), "r")
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
}

/** Child stdio is exactly 0..2: signing pipes and host env never enter Lima. */
export function runBounded(
  executable,
  args,
  { env, timeoutMs, input = null, maxBytes = 16 * 1024 * 1024 }
) {
  demand(
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0,
    "Positive process timeout required"
  )
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    })
    const stdout = [],
      stderr = []
    let bytes = 0,
      truncated = false,
      failure = null,
      escalation
    const kill = () => {
      if (escalation) return
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {}
      escalation = setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL")
        } catch {}
      }, 5000)
    }
    const timer = setTimeout(() => {
      if (failure) return
      failure = new Error("Disposable lifecycle command timed out")
      failure.code = "PROCESS_TIMEOUT"
      kill()
    }, timeoutMs)
    const collect = (stream, chunk) => {
      const remaining = Math.max(0, maxBytes - bytes)
      const captured = chunk.subarray(0, remaining)
      if (captured.length)
        (stream === "stdout" ? stdout : stderr).push(Buffer.from(captured))
      bytes += chunk.length
      if (bytes > maxBytes) {
        truncated = true
        if (!failure) {
          failure = new Error("Disposable command output limit exceeded")
          failure.code = "OUTPUT_LIMIT"
          kill()
        }
        return
      }
    }
    child.stdout.on("data", (chunk) => collect("stdout", chunk))
    child.stderr.on("data", (chunk) => collect("stderr", chunk))
    child.stdin.on("error", () => {})
    child.stdin.end(input)
    child.once("error", (error) => {
      clearTimeout(timer)
      clearTimeout(escalation)
      reject(error)
    })
    child.once("close", (exitCode, signal) => {
      clearTimeout(timer)
      clearTimeout(escalation)
      const output = {
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      }
      if (failure) {
        Object.assign(failure, output, {
          exitCode,
          signal,
          incomplete: true,
          truncated,
        })
        reject(failure)
      } else resolveResult({ exitCode, signal, ...output })
    })
  })
}

export function disposableTemplate(config, request, ownerNonce = null) {
  return {
    vmType: config.vmType,
    arch: config.arch,
    param:
      ownerNonce === null
        ? {}
        : {
            npOwnerNonce: ownerNonce,
            npAttempt: request.attemptId,
            npSourceSha: request.sha,
            npRuntimeSha: request.runtimeSha,
          },
    images: [
      {
        location: config.imagePath,
        arch: config.arch,
        digest: request.imageDigest,
      },
    ],
    cpus: request.resources.cpus,
    memory: `${request.resources.memoryMiB}MiB`,
    disk: `${request.resources.diskMiB}MiB`,
    mounts: [],
    networks: [],
    copyToHost: [],
    provision:
      ownerNonce === null
        ? []
        : [
            {
              mode: "system",
              script:
                "#!/bin/sh\nset -eu\nprintf '%s\\n' '{{.Param.npOwnerNonce}}' '{{.Param.npAttempt}}' '{{.Param.npSourceSha}}' '{{.Param.npRuntimeSha}}' > /var/lib/nabaperks-disposable-owner\nchmod 0600 /var/lib/nabaperks-disposable-owner\n",
            },
          ],
    probes: [],
    user: {
      name: "npcontrol",
      uid: 1000,
      home: "/home/npcontrol",
      shell: "/bin/bash",
    },
    ssh: { forwardAgent: false, loadDotSSHPubKeys: false, forwardX11: false },
    containerd: { user: false, system: false },
    hostResolver: { enabled: false },
    propagateProxyEnv: false,
    rosetta: { enabled: false, binfmt: false },
    portForwards: [{ guestPortRange: [1, 65535], ignore: true }],
  }
}

const LOCKDOWN = `set -eu
[ "$(id -u npcandidate)" = 2000 ]
[ "$(stat -c %u /usr/local/share/nabaperks-ci/runtime-sha)" = 0 ]
! sudo -n -u '#2000' test -w /usr/local/share/nabaperks-ci/runtime-sha
! sudo -n -u '#2000' sudo -n true
! sudo -n -u '#2000' test -r /var/run/docker.sock
if findmnt -rn -t virtiofs,9p,nfs,nfs4,cifs,fuse.sshfs; then exit 1; else [ "$?" = 1 ]; fi
nft -f - <<'NFT'
add table inet np_fixture
add chain inet np_fixture output { type filter hook output priority -200; policy drop; }
add chain inet np_fixture input { type filter hook input priority -200; policy drop; }
add rule inet np_fixture output oifname "lo" accept
add rule inet np_fixture output ct state established,related accept
add rule inet np_fixture input iifname "lo" accept
add rule inet np_fixture input ct state established,related accept
add rule inet np_fixture input tcp dport 22 accept
NFT
cat /usr/local/share/nabaperks-ci/runtime-sha
`

/** Factory is injectable for offline fixtures. Exported protocol uses protected config only. */
export function createLimaDisposableAdapter({
  config,
  run = runBounded,
  verifyPath = protectedPath,
  digest = fileDigest,
  uid = () => process.getuid(),
  lease = null,
}) {
  demand(
    config?.version === 1 && uid() === 0,
    "Disposable adapter requires protected root supervisor"
  )
  demand(
    Number.isSafeInteger(config.serviceUid) &&
      config.serviceUid > 0 &&
      ["qemu", "vz"].includes(config.vmType) &&
      ["aarch64", "x86_64"].includes(config.arch),
    "Invalid dedicated Lima service identity"
  )
  demand(
    [
      config.stateRoot,
      config.inputRoot,
      config.limaHome,
      config.serviceHome,
    ].every(isAbsolute),
    "Absolute dedicated state paths required"
  )
  demand(
    config.stateRoot !== config.limaHome &&
      config.serviceHome !== config.stateRoot,
    "Signing state cannot be shared with Lima service"
  )
  demand(
    config.expected &&
      /^[A-Za-z0-9_-]{1,128}$/.test(config.expected.attemptId) &&
      /^[a-f0-9]{40}$/.test(config.expected.sha) &&
      /^[a-f0-9]{40}$/.test(config.expected.runtimeSha) &&
      /^[a-f0-9]{64}$/.test(config.expected.challenge),
    "Protected candidate identity required"
  )
  for (const path of [config.limactl, config.imagePath, config.bundlePath])
    verifyPath(path)
  mkdirSync(config.stateRoot, { recursive: true, mode: 0o700 })
  verifyPath(config.stateRoot, "directory")
  mkdirSync(config.inputRoot, { recursive: true, mode: 0o755 })
  verifyPath(config.inputRoot, "directory")
  const statePath = join(config.stateRoot, "resources.json")
  let state = { version: 1, attempts: [], resources: [] },
    poisoned = false,
    admission = null
  const reload = () => {
    let loaded = { version: 1, attempts: [], resources: [] }
    try {
      loaded = JSON.parse(readFileSync(statePath, "utf8"))
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    demand(
      loaded.version === 1 &&
        Array.isArray(loaded.attempts) &&
        Array.isArray(loaded.resources) &&
        loaded.resources.every(
          (entry) =>
            /^np-proof-[a-f0-9]{24}$/.test(entry.id) &&
            ["intent", "allocated", "destroyed"].includes(entry.status) &&
            typeof entry.createIssued === "boolean" &&
            /^[a-f0-9]{64}$/.test(entry.ownerNonce)
        ),
      "Invalid resource journal"
    )
    state = loaded
  }
  reload()
  const save = (next) => {
    demand(!poisoned, "Resource journal requires controller restart")
    try {
      atomicWrite(statePath, next)
    } catch (error) {
      poisoned = true
      throw error
    }
    state = next
  }
  const change = (id, fields) =>
    save({
      ...state,
      resources: state.resources.map((entry) =>
        entry.id === id ? { ...entry, ...fields } : entry
      ),
    })
  const resource = (id) => {
    const entry = state.resources.find((entry) => entry.id === id)
    demand(
      entry && /^np-proof-[a-f0-9]{24}$/.test(id),
      "Refusing foreign disposable resource"
    )
    return entry
  }
  const env = { PATH: "/usr/bin:/bin", HOME: "/var/empty", LANG: "C" }
  const command = (args, timeoutMs = 30_000, input = null) =>
    run(
      "/usr/bin/sudo",
      [
        "-n",
        "-u",
        `#${config.serviceUid}`,
        "--",
        "/usr/bin/env",
        "-i",
        `HOME=${config.serviceHome}`,
        `LIMA_HOME=${config.limaHome}`,
        `PATH=${dirname(config.limactl)}:/usr/bin:/bin`,
        "SSH=/usr/bin/ssh",
        config.limactl,
        "--tty=false",
        ...args,
      ],
      { env, timeoutMs, input }
    )
  const checked = async (args, timeoutMs, input) => {
    const result = await command(args, timeoutMs, input)
    demand(
      result.exitCode === 0 && result.signal === null,
      "Disposable lifecycle command failed"
    )
    const decode = (bytes) =>
      typeof bytes === "string"
        ? bytes
        : new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return {
      ...result,
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
    }
  }
  const list = async () => {
    const result = await checked(["list", "--json", "--all-fields"])
    const entries = result.stdout.trim()
      ? result.stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
      : []
    demand(
      entries.every((entry) => typeof entry.name === "string"),
      "Invalid Lima resource readback"
    )
    return entries
  }
  const absent = async (id) => {
    resource(id)
    return !(await list()).some((entry) => entry.name === id)
  }
  const providerOwned = (live, entry) =>
    live.config?.param?.npOwnerNonce === entry.ownerNonce &&
    live.config.param.npAttempt === entry.attemptId &&
    live.config.param.npSourceSha === entry.request.sha &&
    live.config.param.npRuntimeSha === entry.request.runtimeSha
  const destroy = async ({ resourceId }) => {
    const owned = resource(resourceId)
    if (!owned.createIssued) {
      change(resourceId, { status: "destroyed" })
      return
    }
    const live = (await list()).find((entry) => entry.name === resourceId)
    if (live) {
      demand(
        providerOwned(live, owned),
        "Disposable resource ownership is ambiguous; refusing deletion"
      )
      await checked(["delete", "--force", resourceId], 60_000)
      demand(
        await absent(resourceId),
        "Disposable resource deletion unverified"
      )
    }
    change(resourceId, { status: "destroyed" })
  }
  return Object.freeze({
    async reserveAttempt(request) {
      demand(
        same(binding(request), binding(config.expected)),
        "Attempt is not independently admitted"
      )
      if (lease) await lease()
      reload()
      for (const entry of state.resources.filter(
        (entry) => entry.status !== "destroyed"
      ))
        await destroy({ resourceId: entry.id })
      if (
        state.attempts.some(
          (entry) =>
            entry.attemptId === request.attemptId ||
            entry.challenge === request.challenge
        )
      )
        return false
      demand(
        !["default.yaml", "override.yaml"].some((name) =>
          existsSync(join(config.limaHome, "_config", name))
        ),
        "Unreviewed Lima global overrides are not permitted"
      )
      demand(
        (await digest(config.limactl)) === config.limactlDigest &&
          (await digest(config.imagePath)) === config.imageDigest &&
          (await digest(config.bundlePath)) === config.bundleDigest,
        "Pinned image or candidate bundle digest mismatch"
      )
      admission = structuredClone(request)
      save({ ...state, attempts: [...state.attempts, binding(request)] })
      return true
    },
    async allocate(request) {
      demand(
        admission &&
          same(binding(request), binding(admission)) &&
          ROOTS.includes(request.lane),
        "Unreserved disposable allocation"
      )
      demand(
        request.imageDigest === config.imageDigest &&
          request.runtimeSha === config.expected.runtimeSha &&
          request.resources.kind === "disposable-vm" &&
          request.resources.networkPolicy === "fixture-only" &&
          ["cpus", "memoryMiB", "diskMiB"].every(
            (key) =>
              Number.isSafeInteger(request.resources[key]) &&
              request.resources[key] > 0 &&
              request.resources[key] <= config.maxResources[key]
          ),
        "Unqualified disposable resource policy"
      )
      demand(
        !state.resources.some((entry) => entry.status !== "destroyed"),
        "Another disposable lane still owns resources"
      )
      const id = `np-proof-${sha(`${request.attemptId}:${request.lane}`).slice(0, 24)}`
      demand(
        !state.resources.some((entry) => entry.id === id),
        "Disposable lane replay refused"
      )
      const ownerNonce = sha(randomUUID())
      save({
        ...state,
        resources: [
          ...state.resources,
          {
            id,
            attemptId: request.attemptId,
            lane: request.lane,
            status: "intent",
            createIssued: false,
            ownerNonce,
            request,
          },
        ],
      })
      try {
        demand(
          !(await list()).some((entry) => entry.name === id),
          "Existing VM is not fresh disposable execution"
        )
        const templatePath = join(config.inputRoot, `${id}.yaml`)
        // Root-owned/read-only input; dedicated service can read, never edit it.
        writeFileSync(
          templatePath,
          JSON.stringify(disposableTemplate(config, request, ownerNonce)),
          { mode: 0o644, flag: "wx" }
        )
        change(id, { createIssued: true })
        await checked(["create", "--name", id, templatePath], 120_000)
        await checked(["start", "--timeout=5m", id], 310_000)
        const live = (await list()).find((entry) => entry.name === id)
        demand(
          live?.status === "Running" &&
            providerOwned(live, resource(id)) &&
            live.cpus === request.resources.cpus &&
            live.memory === request.resources.memoryMiB * 1024 * 1024 &&
            live.disk === request.resources.diskMiB * 1024 * 1024 &&
            live.arch === config.arch &&
            live.vmType === config.vmType &&
            !live.config?.mounts?.length &&
            !live.config?.networks?.length &&
            live.config?.ssh?.forwardAgent === false &&
            live.config?.ssh?.loadDotSSHPubKeys === false &&
            live.config?.propagateProxyEnv === false &&
            live.config?.rosetta?.enabled === false &&
            live.config?.portForwards?.some(
              (entry) =>
                entry.ignore === true && same(entry.guestPortRange, [1, 65535])
            ) &&
            live.config.portForwards.every((entry) => entry.ignore === true),
          "Disposable VM isolation readback failed"
        )
        const prepared = await checked(
          ["shell", id, "--", "sudo", "-n", "/bin/sh", "-s"],
          30_000,
          LOCKDOWN
        )
        demand(
          prepared.stdout.trim() === request.runtimeSha,
          "Pinned image runtime revision mismatch"
        )
        const firewall = await checked([
          "shell",
          id,
          "--",
          "sudo",
          "-n",
          "nft",
          "-j",
          "list",
          "table",
          "inet",
          "np_fixture",
        ])
        const rules = JSON.parse(firewall.stdout)
        demand(
          Array.isArray(rules.nftables) &&
            ["input", "output"].every((name) =>
              rules.nftables.some(
                (entry) =>
                  entry.chain?.name === name && entry.chain.policy === "drop"
              )
            ),
          "Fixture firewall readback missing"
        )
        await checked(
          [
            "copy",
            "--backend=scp",
            config.bundlePath,
            `${id}:/tmp/source.bundle`,
          ],
          120_000
        )
        const prepare = `set -eu\n[ "$(sha256sum /tmp/source.bundle | cut -d ' ' -f 1)" = ${quote(config.bundleDigest.slice(7))} ]\ninstall -d -o 2000 -g 2000 /workspace\nsudo -n -u '#2000' git clone --no-checkout /tmp/source.bundle /workspace\nsudo -n -u '#2000' git -C /workspace checkout --detach ${quote(request.sha)}\n[ "$(sudo -n -u '#2000' git -C /workspace rev-parse HEAD)" = ${quote(request.sha)} ]\n`
        await checked(
          ["shell", id, "--", "sudo", "-n", "/bin/sh", "-s"],
          120_000,
          prepare
        )
        change(id, {
          status: "allocated",
          firewallDigest: sha(firewall.stdout),
        })
        return {
          id,
          kind: "disposable-vm",
          imageDigest: request.imageDigest,
          runtimeSha: request.runtimeSha,
          sha: request.sha,
          resources: request.resources,
          fresh: true,
          hostMounts: false,
          credentialsForwarded: false,
        }
      } catch (error) {
        await destroy({ resourceId: id })
        throw error
      }
    },
    async execute({ resourceId, argv, timeoutMs }) {
      const entry = resource(resourceId)
      demand(
        entry.status === "allocated" &&
          Array.isArray(argv) &&
          argv.length &&
          argv.every((value) => typeof value === "string" && value.length) &&
          Number.isSafeInteger(timeoutMs) &&
          timeoutMs > 0,
        "Invalid disposable execution"
      )
      const firewall = await checked([
        "shell",
        resourceId,
        "--",
        "sudo",
        "-n",
        "nft",
        "-j",
        "list",
        "table",
        "inet",
        "np_fixture",
      ])
      demand(
        sha(firewall.stdout) === entry.firewallDigest,
        "Fixture firewall changed before candidate execution"
      )
      const result = await command(
        [
          "shell",
          resourceId,
          "--",
          "sudo",
          "-n",
          "-u",
          "#2000",
          "/usr/bin/env",
          "-i",
          "HOME=/home/npcandidate",
          "PATH=/usr/local/bin:/usr/bin:/bin",
          "XDG_RUNTIME_DIR=/run/user/2000",
          "DOCKER_HOST=unix:///run/user/2000/docker.sock",
          "CI=true",
          "/usr/bin/timeout",
          "--signal=TERM",
          "--kill-after=5s",
          `${Math.max(1, Math.floor(timeoutMs / 1000))}s`,
          "/bin/sh",
          "-c",
          'cd /workspace && exec "$@"',
          "sh",
          ...argv,
        ],
        timeoutMs
      ).catch((error) => {
        atomicWrite(
          join(config.stateRoot, `${resourceId}.result.json`),
          auditResult(
            {
              exitCode: null,
              signal: "INCOMPLETE",
              stdout: error.stdout,
              stderr: error.stderr,
            },
            {
              incomplete: true,
              truncated: error.truncated === true,
              failureCode: error.code ?? "EXECUTION_INCOMPLETE",
            }
          )
        )
        throw error
      })
      const after = await checked([
        "shell",
        resourceId,
        "--",
        "sudo",
        "-n",
        "nft",
        "-j",
        "list",
        "table",
        "inet",
        "np_fixture",
      ])
      demand(
        sha(after.stdout) === entry.firewallDigest,
        "Fixture firewall changed during candidate execution"
      )
      atomicWrite(
        join(config.stateRoot, `${resourceId}.result.json`),
        auditResult(result, { incomplete: false, truncated: false })
      )
      return result
    },
    destroy,
    inspectAbsent: ({ resourceId }) => absent(resourceId),
  })
}

let singleton
async function adapter() {
  if (!singleton) {
    protectedPath(new URL(import.meta.url).pathname)
    const config = JSON.parse(readFileSync(protectedPath(CONFIG_PATH), "utf8"))
    // The service UID owns only Lima state; the signer owns admission/journal.
    for (const path of [config.limaHome, config.serviceHome]) {
      const info = lstatSync(path)
      demand(
        info.isDirectory() &&
          !info.isSymbolicLink() &&
          info.uid === config.serviceUid &&
          (info.mode & 0o077) === 0,
        "Dedicated Lima account state is not isolated"
      )
    }
    const leasePath = join(config.stateRoot, "supervisor.lock")
    let held = false
    const lease = async () => {
      if (held) return
      // The already-protected control tree supplies the reviewed exclusive lease.
      const helperPath = new URL("../agent/lease.mjs", import.meta.url).pathname
      protectedPath(helperPath)
      const { acquireControllerLease } = await import(helperPath)
      acquireControllerLease({
        path: leasePath,
        probe: (pid) => {
          try {
            process.kill(pid, 0)
          } catch (error) {
            if (error.code === "ESRCH") return null
            throw error
          }
          return execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
            encoding: "utf8",
            timeout: 5000,
          }).trim()
        },
      })
      held = true
    }
    singleton = createLimaDisposableAdapter({ config, lease })
  }
  return singleton
}
export const reserveAttempt = async (request) =>
  (await adapter()).reserveAttempt(request)
export const allocate = async (request) => (await adapter()).allocate(request)
export const execute = async (request) => (await adapter()).execute(request)
export const destroy = async (request) => (await adapter()).destroy(request)
export const inspectAbsent = async (request) =>
  (await adapter()).inspectAbsent(request)
