/**
 * The "changes at 5am" line under the team code, in the receipt register.
 * Takes the rotation instant the RPC returns and a reference `now` so the
 * label is pure (the harness passes literals; production passes the request
 * time). Never ticks live: the panel is read at a glance, not watched.
 */
export function formatCodeRotation(rotatesAt: string, now: Date): string {
  const rotation = new Date(rotatesAt)
  if (Number.isNaN(rotation.getTime())) return "Changes daily at 5am"

  const hour = londonHour(rotation)
  const at = `Changes at ${formatHour(hour)}`
  const remainingMs = rotation.getTime() - now.getTime()
  if (remainingMs <= 0) return at

  const minutes = Math.floor(remainingMs / 60_000)
  if (minutes < 1) return `${at}, in under a minute`
  if (minutes < 60) {
    return `${at}, in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`
  }
  const hours = Math.round(minutes / 60)
  return `${at}, in ${hours} ${hours === 1 ? "hour" : "hours"}`
}

function londonHour(date: Date): number {
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date)
  return Number(label)
}

function formatHour(hour: number): string {
  if (hour === 0) return "midnight"
  if (hour === 12) return "midday"
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}
