import { notFound } from "next/navigation"

import { StampHarnessCardLane } from "./card-lanes"
import { StampHarnessClient } from "./harness-client"
import { isStampHarnessCardMode, isStampHarnessMode } from "./modes"

export default async function StampHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; delay?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const requested = query.mode ?? ""
  if (isStampHarnessCardMode(requested)) {
    return <StampHarnessCardLane mode={requested} />
  }
  const mode = isStampHarnessMode(requested) ? requested : "success"
  const parsedDelay = Number(query.delay ?? "450")
  const delayMs = Number.isFinite(parsedDelay)
    ? Math.min(Math.max(parsedDelay, 0), 5000)
    : 450

  return <StampHarnessClient mode={mode} delayMs={delayMs} />
}
