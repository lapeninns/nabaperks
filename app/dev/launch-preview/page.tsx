import { GooglePlacesVenuePreview } from "@/app/dev/launch-preview/google-places-harness"
import { VenueGeofenceScenarioPreview } from "@/app/dev/launch-preview/screens"

type LaunchPreviewIndexProps = {
  searchParams: Promise<{ tab?: string; scenario?: string }>
}

/**
 * Query-param preview index for the agent browser proof. `?tab=venue` renders
 * a named geofence scenario so Playwright can drive the geofence pin map without a
 * Supabase session. The path-based `[state]` route still serves the launch-hub
 * screenshot states.
 */
export default async function LaunchPreviewIndexPage({
  searchParams,
}: LaunchPreviewIndexProps) {
  const { tab, scenario } = await searchParams

  if (tab === "venue") {
    // Mocked Google Places scenarios for the agent browser proof. `places-mock`
    // injects a fake importLibrary so a selection fills the form; `places-nokey`
    // omits the key so the manual fallback is the only path.
    if (scenario === "places-mock" || scenario === "places-nokey") {
      return (
        <div
          data-launch-preview-tab="venue"
          data-launch-preview-scenario={scenario}
        >
          <GooglePlacesVenuePreview
            apiKeyConfigured={scenario === "places-mock"}
          />
        </div>
      )
    }

    const resolvedScenario: "geofence-on" | "geofence-off" =
      scenario === "geofence-off" ? "geofence-off" : "geofence-on"

    return (
      <div
        data-launch-preview-tab="venue"
        data-launch-preview-scenario={resolvedScenario}
      >
        <VenueGeofenceScenarioPreview scenario={resolvedScenario} />
      </div>
    )
  }

  return (
    <div data-launch-preview-tab={tab ?? "none"} className="p-6 text-sm">
      Launch preview. Use the venue scenario query (tab=venue,
      scenario=geofence-on) to preview the geofence pin map.
    </div>
  )
}
