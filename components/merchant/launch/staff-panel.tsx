import { redirect } from "next/navigation"

import {
  revokeStationAction,
  setStaffActiveAction,
} from "@/app/app/staff/actions"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import {
  AddStaffForm,
  CreateStationForm,
} from "@/components/merchant/staff-station-forms"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { listStaffMembers } from "@/lib/merchant/staff-members"
import { listStations } from "@/lib/merchant/stations"

export async function StaffPanel() {
  const merchant = await getCurrentMerchant()

  if (!merchant) redirect("/app/onboarding")

  const [staffMembers, stations] = await Promise.all([
    listStaffMembers(),
    listStations(),
  ])

  const visibleStations = stations.filter(
    (station) => station.status !== "revoked"
  )

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <Eyebrow>Staff &amp; stations</Eyebrow>
        <h2 className="text-3xl font-extrabold leading-tight">
          Who stamps, and where
        </h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Customers show a short-lived code; your team approves it on a paired
          counter station. Each stamp is signed with a staff name — no shared
          PINs typed on customer phones.
        </p>
      </header>

      <ReceiptCard className="grid gap-5">
        <div className="grid gap-1">
          <h3 className="text-xl font-extrabold">Staff members</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Each person gets their own PIN for starting a session on the
            counter station.
          </p>
        </div>

        {staffMembers.length > 0 ? (
          <ul className="grid gap-2">
            {staffMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink/15 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.displayName}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {member.isActive ? member.role : "Deactivated"}
                  </p>
                </div>
                <form action={setStaffActiveAction}>
                  <input type="hidden" name="staffId" value={member.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={member.isActive ? "false" : "true"}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    {member.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-accent px-4 py-3 text-sm leading-6">
            No staff yet. Add the people who work the counter — display names
            are enough, no email needed.
          </p>
        )}

        <AddStaffForm />
      </ReceiptCard>

      <ReceiptCard className="grid gap-5">
        <div className="grid gap-1">
          <h3 className="text-xl font-extrabold">Counter stations</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Pair the till device once with a pairing code. Open{" "}
            <span className="font-mono text-xs">/staff</span> on that device
            and it becomes the counter station.
          </p>
        </div>

        {visibleStations.length > 0 ? (
          <ul className="grid gap-2">
            {visibleStations.map((station) => (
              <li
                key={station.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink/15 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{station.stationName}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {station.status === "active"
                      ? `Paired${station.lastSeenAt ? ` · last seen ${formatDateTime(station.lastSeenAt)}` : ""}`
                      : station.pairingCode
                        ? `Pairing code ${station.pairingCode} · expires ${formatDateTime(station.pairingExpiresAt)}`
                        : "Waiting to pair"}
                  </p>
                </div>
                <form action={revokeStationAction}>
                  <input type="hidden" name="stationId" value={station.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-accent px-4 py-3 text-sm leading-6">
            No stations yet. Create one to get a pairing code for the counter
            device.
          </p>
        )}

        <CreateStationForm />
      </ReceiptCard>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "soon"

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}
