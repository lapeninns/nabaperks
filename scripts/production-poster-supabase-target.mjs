import { readFileSync } from "node:fs"

const CONTRACT_URL = new URL(
  "../config/supabase-governance-contract.json",
  import.meta.url
)
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"])

export function readCanonicalProductionSupabaseRef() {
  const contract = JSON.parse(readFileSync(CONTRACT_URL, "utf8"))
  const ref = contract?.productionProject?.ref
  if (typeof ref !== "string" || !/^[a-z]{20}$/.test(ref)) {
    throw new Error("Canonical production Supabase project is invalid.")
  }
  return ref
}

export function resolveProductionPosterCredentials({
  envFileSelected,
  fileEnv,
  processEnv,
}) {
  const source = envFileSelected ? fileEnv : processEnv
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      envFileSelected
        ? "The explicit poster environment file must contain both required Supabase fields."
        : "The process environment must contain both required Supabase fields."
    )
  }

  return { serviceRoleKey, supabaseUrl }
}

export function assertProductionPosterSupabaseTarget(
  value,
  { allowLocal = false, productionRef } = {}
) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error("Poster export Supabase target is invalid.")
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  const isLocal = LOCAL_HOSTS.has(hostname)
  const commonShape =
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash

  if (isLocal) {
    if (
      !allowLocal ||
      !commonShape ||
      !["http:", "https:"].includes(url.protocol)
    ) {
      throw new Error("Poster export Supabase target is not authorised.")
    }
    return url.origin
  }

  if (
    !commonShape ||
    url.protocol !== "https:" ||
    typeof productionRef !== "string" ||
    url.origin !== `https://${productionRef}.supabase.co`
  ) {
    throw new Error("Poster export Supabase target is not authorised.")
  }

  return url.origin
}
