type PilotProofStat = {
  readonly value: string
  readonly label: string
}

export const SHOW_PILOT_PROOF = false

const pilotProofStats: readonly PilotProofStat[] = []

export function PilotProofStrip() {
  if (!SHOW_PILOT_PROOF || pilotProofStats.length === 0) {
    return null
  }

  return (
    <aside
      aria-label="Pilot snapshot"
      className="mt-4 border-b-2 border-dashed border-foreground/25 pb-4"
    >
      <p className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-primary uppercase">
        Pilot snapshot
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-4">
        {pilotProofStats.map((stat) => (
          <div key={stat.label}>
            <dt className="font-mono text-[0.6rem] tracking-[0.06em] text-muted-foreground uppercase">
              {stat.label}
            </dt>
            <dd className="mt-1 text-2xl leading-none font-extrabold tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
