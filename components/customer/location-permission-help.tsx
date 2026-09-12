"use client"

import { useId, useState } from "react"

import {
  LOCATION_HELP,
  locationHelpBrowser,
  type LocationHelpBrowser,
} from "@/lib/customer/stamp-location-recovery"

/** Mounted only after a browser capture fails; no server-side UA assumption. */
export function LocationPermissionHelp({
  nativeRecovery = false,
}: {
  nativeRecovery?: boolean
}) {
  const id = useId()
  const [browser, setBrowser] = useState<LocationHelpBrowser>(() =>
    typeof navigator === "undefined"
      ? "generic"
      : locationHelpBrowser(navigator)
  )
  const help = LOCATION_HELP[browser]
  return (
    <div className="grid gap-2 text-sm leading-5" data-location-permission-help>
      <p>
        {nativeRecovery
          ? "Use the location button above and choose Allow. Chrome can ask again even if this site was blocked before."
          : "If access was blocked before, your browser may not show the prompt again. Update its location settings, then retry."}
      </p>
      <p>
        <strong>{help.label}</strong>
        <br />
        {help.steps}
      </p>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
          Need help?
        </summary>
        <div className="grid gap-3 pb-2">
          <label htmlFor={id} className="font-bold">
            Your browser
          </label>
          <select
            id={id}
            value={browser}
            onChange={(event) =>
              setBrowser(event.target.value as LocationHelpBrowser)
            }
            className="min-h-11 w-full rounded-md border-2 border-line bg-background px-3"
          >
            {Object.entries(LOCATION_HELP).map(([value, entry]) => (
              <option key={value} value={value}>
                {entry.label}
              </option>
            ))}
          </select>
          <p>{help.detail}</p>
          <p>Nabaperks can&apos;t change these settings for you.</p>
        </div>
      </details>
    </div>
  )
}
