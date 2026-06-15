import "server-only"

type ServerTimingLog = {
  readonly route: string
  readonly loader: string
  readonly ms: number
}

export async function timeServerLoader<T>(
  route: string,
  loader: string,
  load: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now()

  try {
    return await load()
  } finally {
    logServerTiming({
      route,
      loader,
      ms: performance.now() - startedAt,
    })
  }
}

export function logServerTiming(input: ServerTimingLog) {
  if (process.env.PERF_LOG !== "1") {
    return
  }

  console.log(
    JSON.stringify({
      route: input.route,
      loader: input.loader,
      ms: roundMs(input.ms),
    })
  )
}

function roundMs(ms: number) {
  return Math.round(ms * 10) / 10
}
