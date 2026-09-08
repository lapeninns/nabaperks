/** Recover reserved, fully labelled resources only while holding the host lease. */
import { join } from "node:path"
import { assertControllerLeaseOwned } from "./lease.mjs"

const label = (labels, name) => labels?.[`com.nabaperks.local-ci.${name}`]
const names = (text) => text.trim().split(/\r?\n/).filter(Boolean)
const ownedContainer = (name) => /^nabaperks-ci-(job|dind)-/.test(name)
const ownedNetwork = (name) => name.startsWith("nabaperks-ci-net-")

export function recoveryPlan({ containers, networks, profiles }) {
  const checked = (resource, kind) => {
    const name = resource.name.replace(/^\//, "")
    const match =
      /^nabaperks-ci-(job|dind|net)-([a-f0-9]{12})-([a-z0-9][a-z0-9-]*)-([1-9][0-9]*)$/.exec(
        name
      )
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
      throw new Error(
        `Unverifiable local CI resource ${name}; operator reconciliation required`
      )
    return { id: resource.id, name, kind }
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
  return [
    ...jobs.sort(
      (a, b) =>
        Number(a.name.includes("-dind-")) - Number(b.name.includes("-dind-"))
    ),
    ...nets,
  ]
}

export async function reconcileAgentResources({
  vm,
  stateRoot,
  profiles,
  exec,
  now = Date.now,
  assertLease = () =>
    assertControllerLeaseOwned({ path: join(stateRoot, "controller.lock") }),
}) {
  const docker = ["limactl", "shell", vm, "--", "docker"]
  const deadline = now() + 120_000
  const run = (args) => {
    const remaining = deadline - now()
    if (remaining <= 0)
      throw new Error("Local CI resource recovery deadline expired")
    return exec([...docker, ...args], {
      timeoutMs: Math.min(30_000, remaining),
    })
  }
  const inventory = async () => ({
    containers: names(
      await run(["ps", "--all", "--format", "{{.Names}}"])
    ).filter(ownedContainer),
    networks: names(
      await run(["network", "ls", "--format", "{{.Name}}"])
    ).filter(ownedNetwork),
  })
  assertLease()
  const found = await inventory()
  if (found.containers.length + found.networks.length > 128)
    throw new Error(
      "Unexpected local CI resource inventory; operator reconciliation required"
    )
  const containers = []
  const networks = []
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
  const plan = recoveryPlan({ containers, networks, profiles })
  for (const resource of plan) {
    assertLease()
    // Remove the inspected immutable ID, never a name that could be reassigned.
    await run(
      resource.kind === "network"
        ? ["network", "rm", resource.id]
        : ["rm", "--force", resource.id]
    )
  }
  const remaining = await inventory()
  if (remaining.containers.length || remaining.networks.length)
    throw new Error(
      "Local CI resource absence could not be verified; refusing dispatch"
    )
  return { recovered: plan.map(({ name }) => name) }
}
