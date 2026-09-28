import assert from "node:assert/strict"
import { test } from "node:test"

import {
  RUNTIME_KINDS,
  runtimeKind,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import { CONTRACT_TEXT, limaRollback } from "../support/local-ci-contracts.mjs"

/**
 * local CI - the contract's runtime block.
 *
 * The block decides where pull-request code runs and what it is given, so a
 * contract edit that widened it - a bind mount, a privileged container, a job
 * network with a gateway, a sweep that may prune - is a refusal at load time,
 * before any adapter code runs.
 */

const raw = () => JSON.parse(CONTRACT_TEXT)

test("the committed contract selects Docker Desktop, and a contract without a runtime means Lima", () => {
  assert.deepEqual(RUNTIME_KINDS, ["lima", "docker-desktop"])
  const committed = validateContract(raw())
  assert.equal(runtimeKind(committed), "docker-desktop")
  const legacy = raw()
  delete legacy.runtime
  legacy.container.cpus = 10
  legacy.container.memoryGb = 32
  legacy.container.dockerInDocker = true
  assert.equal(runtimeKind(validateContract(legacy)), "lima")
  assert.equal(runtimeKind(validateContract(limaRollback(raw()))), "lima")
  assert.equal(runtimeKind(undefined), "lima")
})

test("a runtime block that widens what a job is given is refused at load", () => {
  const cases = [
    [(c) => (c.runtime.kind = "podman"), "CONTRACT_SHAPE"],
    [(c) => c.runtime.bindMounts.push("/Users"), "RUNTIME_ISOLATION"],
    [
      (c) => c.runtime.privilegedContainers.push("netguard"),
      "RUNTIME_ISOLATION",
    ],
    [(c) => (c.runtime.jobNetwork.internal = false), "RUNTIME_ISOLATION"],
    [
      (c) => (c.runtime.jobNetwork.subnetPool = "172.16.0.0/12"),
      "CONTRACT_SHAPE",
    ],
    [(c) => (c.runtime.cleanup.prune = true), "RUNTIME_ISOLATION"],
    [
      (c) => (c.runtime.envFiles.carriesHostSecrets = true),
      "RUNTIME_ISOLATION",
    ],
    [(c) => (c.runtime.envFiles.passedAs = "--env"), "RUNTIME_ISOLATION"],
    [
      (c) => (c.runtime.helper.refuseConfigDependencies = false),
      "RUNTIME_ISOLATION",
    ],
    [
      (c) => (c.runtime.helper.egress.publicAddressesOnly = false),
      "RUNTIME_ISOLATION",
    ],
    [(c) => (c.runtime.helper.egress.mode = "direct"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.helper.user = "0:0"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.dockerCli = "docker"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.dockerConfig = "../config"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.stateVolume = "postgres-data"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.minServerVersion = "latest"), "CONTRACT_SHAPE"],
    [(c) => (c.runtime.memoryGb = 0), "CONTRACT_SHAPE"],
    [(c) => (c.container.dockerInDocker = true), "RUNTIME_ISOLATION"],
    [(c) => (c.container.memoryGb = 41), "RESOURCE_OVERCOMMIT"],
    [(c) => (c.runtime.reserveCpus = 3), "RESOURCE_OVERCOMMIT"],
  ]
  for (const [edit, code] of cases) {
    const contract = raw()
    edit(contract)
    assert.throws(
      () => validateContract(contract),
      (error) => {
        assert.equal(error.code, code, edit.toString())
        return true
      }
    )
  }
})
