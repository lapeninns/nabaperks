import { enforceRateLimit } from "@/lib/security/rate-limit"

const PUSH_MUTATION_LIMIT = 20
const PUSH_MUTATION_WINDOW_MS = 60_000

export async function enforcePushMutationRateLimit(customerId: string) {
  await enforceRateLimit({
    key: `push-mutation:${customerId}`,
    limit: PUSH_MUTATION_LIMIT,
    windowMs: PUSH_MUTATION_WINDOW_MS,
  })
}
