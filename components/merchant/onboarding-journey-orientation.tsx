import { IconRoundel, ReceiptCard } from "@/components/brand"
import { MERCHANT_SETUP_STEPS } from "@/lib/merchant/launch-readiness-contract"

type OnboardingJourneyOrientationProps =
  | { variant: "summary" }
  | { variant: "roadmap" }

/** Shared journey orientation for the real onboarding route and DB-free harness. */
export function OnboardingJourneyOrientation(
  props: OnboardingJourneyOrientationProps
) {
  if (props.variant === "summary") {
    return (
      <div
        data-onboarding-orientation="summary"
        className="rounded-lg border-2 border-dashed border-line bg-paper-deep/45 px-3 py-2.5 lg:hidden"
      >
        <p className="text-sm leading-6 font-bold text-pretty">
          Share this venue, then approve the pre-filled card and rewards before
          billing unlocks your QR.
        </p>
      </div>
    )
  }

  return (
    <aside className="grid h-fit lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <ReceiptCard padding="sm" className="grid gap-4">
        <div>
          <p className="eyebrow">What happens next</p>
          <h2 className="mt-2 text-xl leading-tight font-extrabold">
            From sign-up to your first stamp
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Share the venue details we need, then use the launch workspace to
            approve each part before your QR goes live.
          </p>
        </div>
        <ol className="grid gap-3">
          {MERCHANT_SETUP_STEPS.map((step, index) => (
            <li key={step.id} className="grid grid-cols-[2rem_1fr] gap-3">
              <IconRoundel
                size="sm"
                tone="card"
                className="font-mono text-sm font-bold shadow-sm"
              >
                {index + 1}
              </IconRoundel>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </ReceiptCard>
    </aside>
  )
}
