export type EnvVisibility = "public" | "server"

export type EnvKind = "string" | "url"

export type EnvContractEntry = {
  name: string
  visibility: EnvVisibility
  kind: EnvKind
  description: string
  optional?: boolean
}

export class EnvConfigError extends Error {
  readonly missing: string[]
  readonly invalid: string[]

  constructor({
    missing,
    invalid,
  }: {
    missing: string[]
    invalid: string[]
  }) {
    const details = [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      invalid.length ? `invalid: ${invalid.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ")

    super(
      `Nabaperks environment configuration is incomplete${
        details ? ` (${details})` : ""
      }. Copy .env.example to .env.local and fill the required values.`
    )

    this.name = "EnvConfigError"
    this.missing = missing
    this.invalid = invalid
  }
}

export function assertValidEnv(
  contract: readonly EnvContractEntry[],
  values: Record<string, string | undefined>
) {
  const missing: string[] = []
  const invalid: string[] = []

  for (const entry of contract) {
    const value = values[entry.name]?.trim()

    if (!value) {
      if (entry.optional) continue
      missing.push(entry.name)
      continue
    }

    if (entry.visibility === "public" && !entry.name.startsWith("NEXT_PUBLIC_")) {
      invalid.push(`${entry.name} must be prefixed with NEXT_PUBLIC_`)
    }

    if (entry.visibility === "server" && entry.name.startsWith("NEXT_PUBLIC_")) {
      invalid.push(`${entry.name} must not be prefixed with NEXT_PUBLIC_`)
    }

    if (entry.kind === "url") {
      try {
        const url = new URL(value)

        if (!["http:", "https:"].includes(url.protocol)) {
          invalid.push(`${entry.name} must use http or https`)
        }
      } catch {
        invalid.push(`${entry.name} must be a valid URL`)
      }
    }
  }

  if (missing.length || invalid.length) {
    throw new EnvConfigError({ missing, invalid })
  }
}
