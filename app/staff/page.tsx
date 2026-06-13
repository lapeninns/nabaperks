import { cookies } from "next/headers"

import { StationConsole } from "@/components/staff/station-console"
import { StationPairingForm } from "@/components/staff/station-pairing-form"
import { Eyebrow, VenueMark } from "@/components/brand"
import { StaffShell } from "@/components/layout"
import {
  getStationState,
  parseStationCookie,
  STATION_COOKIE,
} from "@/lib/staff/station"

export const dynamic = "force-dynamic"

export default async function StaffStationPage() {
  const cookieStore = await cookies()
  const credentials = parseStationCookie(
    cookieStore.get(STATION_COOKIE)?.value
  )

  if (!credentials) {
    return (
      <StaffShell>
        <PairingCard />
      </StaffShell>
    )
  }

  const state = await getStationState(credentials)

  if (state.status !== "ready") {
    return (
      <StaffShell>
        <PairingCard repair />
      </StaffShell>
    )
  }

  return (
    <StaffShell className="max-w-md">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Staff station</Eyebrow>
          <h1 className="truncate text-2xl font-extrabold leading-tight">
            {state.merchantName}
          </h1>
          <p className="truncate font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            {state.stationName}
          </p>
        </div>
        <VenueMark size={52} name={state.merchantName} caption="Staff" />
      </header>

      <StationConsole
        stationName={state.stationName}
        merchantName={state.merchantName}
        session={state.session}
        staffMembers={state.staffMembers}
        stampsToday={state.stampsToday}
        redemptionsToday={state.redemptionsToday}
        lastAction={state.lastAction}
        lockedUntil={state.lockedUntil}
      />
    </StaffShell>
  )
}

function PairingCard({ repair = false }: { repair?: boolean }) {
  return (
    <section className="surface-card grid gap-5 p-6">
      <div className="grid gap-2 text-center">
        <Eyebrow>Staff station</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight text-balance">
          {repair ? "Pair this station again" : "Pair this station"}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {repair
            ? "This device is no longer trusted for the counter. Enter a fresh pairing code to reconnect it."
            : "One paired device per counter. Customers show a code; you approve it here — nobody hands a phone across."}
        </p>
      </div>
      <StationPairingForm />
    </section>
  )
}
