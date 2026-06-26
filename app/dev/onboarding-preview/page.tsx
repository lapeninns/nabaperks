import { GooglePlacesOnboardingPreview } from "@/app/dev/onboarding-preview/google-places-harness"

type OnboardingPreviewPageProps = {
  searchParams: Promise<{ scenario?: string }>
}

/**
 * Local-only onboarding Places proof. `?scenario=places-mock` mounts the real
 * `OnboardingForm` with a fake Google loader so localhost verification never
 * needs auth or a live Maps network call.
 */
export default async function OnboardingPreviewPage({
  searchParams,
}: OnboardingPreviewPageProps) {
  const { scenario } = await searchParams

  if (scenario === "places-mock" || scenario === "places-nokey") {
    return (
      <div
        data-onboarding-preview-scenario={scenario}
        className="mx-auto w-full max-w-5xl px-4 py-8"
      >
        <GooglePlacesOnboardingPreview
          apiKeyConfigured={scenario === "places-mock"}
        />
      </div>
    )
  }

  return (
    <div className="p-6 text-sm">
      Onboarding preview. Use{" "}
      <code>?scenario=places-mock</code> or <code>?scenario=places-nokey</code>.
    </div>
  )
}
