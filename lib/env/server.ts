import "server-only"

import envContract from "@/config/env-contract.json"
import { assertValidEnv, type EnvContractEntry } from "@/lib/env/validate"

export function getServerEnv() {
  const values = Object.fromEntries(
    (envContract as EnvContractEntry[]).map((entry) => [
      entry.name,
      process.env[entry.name],
    ])
  )

  assertValidEnv(envContract as EnvContractEntry[], values)

  return values as Record<(typeof envContract)[number]["name"], string>
}
