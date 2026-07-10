import envContract from "@/config/env-contract.json"
import { assertValidEnv, type EnvContractEntry } from "@/lib/env/validate"

const publicContract = (envContract as EnvContractEntry[]).filter(
  (entry) => entry.visibility === "public"
)

export function getPublicEnv() {
  const values = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  }

  assertValidEnv(publicContract, values)

  return values as Record<keyof typeof values, string>
}
