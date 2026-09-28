/**
 * Recover reserved, fully labelled resources only while holding the host lease.
 *
 * Two inventories exist. Inside the Lima VM this plane is the daemon's only
 * tenant, so its job, sidecar and network names are listed and each one is
 * validated before removal. On a shared Docker Desktop daemon other worktrees'
 * stacks sit beside it, so only resources carrying the agent's
 * `com.nabaperks.local-ci.` labels are listed at all, a resource must also
 * carry the `nabaperks-ci-` name prefix, and each is validated against the
 * role its labels claim before its inspected immutable ID is removed. Volumes
 * are swept the same way, except the state volume. Nothing here ever prunes:
 * a prune on a shared daemon deletes other stacks' resources.
 */
import { join } from "node:path"
import { assertControllerLeaseOwned } from "./lease.mjs"

const LABEL_PREFIX = "com.nabaperks.local-ci."
const NAME_PREFIX = "nabaperks-ci-"
const ROLE_LABEL = `${LABEL_PREFIX}role`
const label = (labels, name) => labels?.[`${LABEL_PREFIX}${name}`]
const names = (text) => text.trim().split(/\r?\n/).filter(Boolean)
const ownedContainer = (name) => /^nabaperks-ci-(job|dind)-/.test(name)
const ownedNetwork = (name) => name.startsWith("nabaperks-ci-net-")

const LANE_RESOURCE =
  /^nabaperks-ci-(job|dind|net)-([a-f0-9]{12})-([a-z0-9][a-z0-9-]*)-([1-9][0-9]*)$/

/**
 * The runtime's own infrastructure on a shared daemon, by role. Each name is
 * bound to a head SHA prefix or a random id, and a role label that disagrees
 * with the name makes the resource unverifiable rather than removable.
 */
const INFRASTRUCTURE = Object.freeze({
  helper: { kind: "container", name: /^nabaperks-ci-helper-[a-f0-9]{12}$/ },
  proxy: { kind: "container", name: /^nabaperks-ci-proxy-([a-f0-9]{12})$/ },
  canary: {
    kind: ["container", "network"],
    name: /^nabaperks-ci-canary-[a-f0-9]{12}$/,
  },
  prep: { kind: "network", name: /^nabaperks-ci-prep-([a-f0-9]{12})$/ },
  egress: { kind: "network", name: /^nabaperks-ci-egress-([a-f0-9]{12})$/ },
})

function unverifiable(name) {
  return new Error(
    `Unverifiable local CI resource ${name}; operator reconciliation required`
  )
}

function checkedLaneResource(resource, kind, profiles) {
  const name = resource.name.replace(/^\//, "")
  const match = LANE_RESOURCE.exec(name)
  const sha = label(resource.labels, "head-sha")
  const lane = label(resource.labels, "lane")
  const profile = label(resource.labels, "profile")
  if (
    !match ||
    !/^[a-f0-9]{64}$/.test(resource.id) ||
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    sha.slice(0, 12) !== match[2] ||
    lane !== match[3] ||
    !profiles[profile]?.includes(lane) ||
    (kind === "network") !== (match[1] === "net")
  )
    throw unverifiable(name)
  return { id: resource.id, name, kind }
}

function checkedInfrastructure(resource, kind) {
  const name = resource.name.replace(/^\//, "")
  const role = label(resource.labels, "role")
  const rule = INFRASTRUCTURE[role]
  const kinds = [rule?.kind].flat()
  const match = rule?.name.exec(name)
  const sha = label(resource.labels, "head-sha")
  if (
    !rule ||
    !kinds.includes(kind) ||
    !match ||
    !/^[a-f0-9]{64}$/.test(resource.id) ||
    (match[1] !== undefined &&
      (!/^[a-f0-9]{40}$/.test(sha ?? "") || sha.slice(0, 12) !== match[1]))
  )
    throw unverifiable(name)
  return { id: resource.id, name, kind }
}

export function recoveryPlan({
  containers,
  networks,
  profiles,
  volumes = [],
  protectedVolumes = [],
}) {
  const checked = (resource, kind) => {
    const name = resource.name.replace(/^\//, "")
    const role = label(resource.labels, "role")
    // A resource that says it is job, sidecar or lane network infrastructure
    // - or says nothing - answers to the strict per-lane rule; anything else
    // must be one of the runtime's named infrastructure roles.
    return role === undefined || ["job", "dind", "net"].includes(role)
      ? checkedLaneResource({ ...resource, name }, kind, profiles)
      : checkedInfrastructure({ ...resource, name }, kind)
  }
  const jobs = containers.map((resource) => checked(resource, "container"))
  const ids = new Set(jobs.map((job) => job.id))
  const nets = networks.map((resource) => {
    const network = checked(resource, "network")
    if (Object.keys(resource.containers ?? {}).some((id) => !ids.has(id)))
      throw new Error(
        `Local CI network ${network.name} has an unrelated endpoint`
      )
    return network
  })
  const vols = volumes
    .filter((resource) => !protectedVolumes.includes(resource.name))
    .map((resource) => {
      const name = resource.name
      if (
        !name.startsWith(NAME_PREFIX) ||
        !/^[a-z0-9][a-z0-9_.-]*$/.test(name) ||
        label(resource.labels, "role") === "state" ||
        label(resource.labels, "role") === undefined
      )
        throw unverifiable(name)
      // A volume's name is its only identity; it is removed only after every
      // container that could use it has gone, and the daemon refuses a
      // volume still in use.
      return { id: name, name, kind: "volume" }
    })
  return [
    ...jobs.sort(
      (a, b) =>
        Number(a.name.includes("-dind-")) - Number(b.name.includes("-dind-"))
    ),
    ...nets,
    ...vols,
  ]
}

/**
 * Sweep what a killed controller left behind.
 *
 * `vm` selects the Lima inventory, as before. `docker` - a CLI prefix such
 * as `[docker, --context, desktop-linux]` - selects the shared-daemon
 * inventory: resources are listed only through the agent's own label, every
 * listed name must also carry the `nabaperks-ci-` prefix, and `labelFilters`
 * narrow the listing further (the development dry run adds its own label).
 */
export async function reconcileAgentResources({
  vm,
  docker = null,
  stateRoot,
  profiles,
  exec,
  labelFilters = [],
  protectedVolumes = [],
  now = Date.now,
  assertLease = () =>
    assertControllerLeaseOwned({ path: join(stateRoot, "controller.lock") }),
}) {
  const shared = docker !== null
  const prefix = shared ? docker : ["limactl", "shell", vm, "--", "docker"]
  const deadline = now() + 120_000
  const run = (args) => {
    const remaining = deadline - now()
    if (remaining <= 0)
      throw new Error("Local CI resource recovery deadline expired")
    return exec([...prefix, ...args], {
      timeoutMs: Math.min(30_000, remaining),
    })
  }
  const filters = [
    "--filter",
    `label=${ROLE_LABEL}`,
    ...labelFilters.flatMap((filter) => ["--filter", `label=${filter}`]),
  ]
  const inventory = async () =>
    shared
      ? {
          containers: names(
            await run(["ps", "--all", ...filters, "--format", "{{.Names}}"])
          ).filter((name) => name.startsWith(NAME_PREFIX)),
          networks: names(
            await run(["network", "ls", ...filters, "--format", "{{.Name}}"])
          ).filter((name) => name.startsWith(NAME_PREFIX)),
          volumes: names(
            await run(["volume", "ls", ...filters, "--format", "{{.Name}}"])
          ).filter(
            (name) =>
              name.startsWith(NAME_PREFIX) && !protectedVolumes.includes(name)
          ),
        }
      : {
          containers: names(
            await run(["ps", "--all", "--format", "{{.Names}}"])
          ).filter(ownedContainer),
          networks: names(
            await run(["network", "ls", "--format", "{{.Name}}"])
          ).filter(ownedNetwork),
          volumes: [],
        }
  assertLease()
  const found = await inventory()
  if (
    found.containers.length + found.networks.length + found.volumes.length >
    128
  )
    throw new Error(
      "Unexpected local CI resource inventory; operator reconciliation required"
    )
  const containers = []
  const networks = []
  const volumes = []
  for (const name of found.containers)
    containers.push(
      JSON.parse(
        await run([
          "inspect",
          "--format",
          '{"id":{{json .Id}},"name":{{json .Name}},"labels":{{json .Config.Labels}}}',
          name,
        ])
      )
    )
  for (const name of found.networks)
    networks.push(
      JSON.parse(
        await run([
          "network",
          "inspect",
          "--format",
          '{"id":{{json .Id}},"name":{{json .Name}},"labels":{{json .Labels}},"containers":{{json .Containers}}}',
          name,
        ])
      )
    )
  for (const name of found.volumes)
    volumes.push(
      JSON.parse(
        await run([
          "volume",
          "inspect",
          "--format",
          '{"name":{{json .Name}},"labels":{{json .Labels}}}',
          name,
        ])
      )
    )
  const plan = recoveryPlan({
    containers,
    networks,
    profiles,
    volumes,
    protectedVolumes,
  })
  for (const resource of plan) {
    assertLease()
    // Remove the inspected immutable ID, never a name that could be reassigned.
    await run(
      resource.kind === "network"
        ? ["network", "rm", resource.id]
        : resource.kind === "volume"
          ? ["volume", "rm", resource.id]
          : ["rm", "--force", resource.id]
    )
  }
  const remaining = await inventory()
  if (
    remaining.containers.length ||
    remaining.networks.length ||
    remaining.volumes.length
  )
    throw new Error(
      "Local CI resource absence could not be verified; refusing dispatch"
    )
  return { recovered: plan.map(({ name }) => name) }
}
