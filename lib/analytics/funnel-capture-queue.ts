import type {
  FunnelCaptureResponse,
  PublicFunnelEvent,
} from "@/lib/analytics/funnel-contract"

type FunnelCaptureQueueDependencies = Readonly<{
  postCapture: (
    event: PublicFunnelEvent,
    token: string | null
  ) => Promise<FunnelCaptureResponse | null>
  readToken: () => string | null
  rememberToken: (token: string) => boolean
}>

export function createFunnelCaptureQueue({
  postCapture,
  readToken,
  rememberToken,
}: FunnelCaptureQueueDependencies) {
  let queue: Promise<void> = Promise.resolve()

  return {
    capture(event: PublicFunnelEvent): Promise<void> {
      const queuedCapture = queue.then(async () => {
        const token = readToken()

        try {
          const result = await postCapture(event, token)
          if (!result) return

          if (token) {
            rememberToken(result.token)
            return
          }

          // Issuance is deliberately separate from the first write. Keep the
          // identity in session storage before recording so a lost write
          // response can retry with the same deterministic event UUID.
          if (!rememberToken(result.token)) return
          const recorded = await postCapture(event, result.token)
          if (recorded) rememberToken(recorded.token)
        } catch {
          // First-party measurement is best effort and cannot block navigation.
        }
      })

      // The queue serializes work only. It never retains a funnel token; every
      // queued capture reads the current sessionStorage value when it starts.
      queue = queuedCapture.catch(() => undefined)
      return queuedCapture
    },
  }
}
