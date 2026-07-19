import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { DFY_LAUNCH } from "@/lib/marketing/facts"

import { LaunchSteps } from "./launch-steps"

/** Visible HowTo content matching the homepage HowTo JSON-LD node. */
export function LaunchProcess() {
  return (
    <Section id="launch" size="dense">
      <SectionHeader
        eyebrow="How the launch works"
        title="Five steps. We do the setup; you approve the launch."
        description={DFY_LAUNCH.covers}
      />
      <LaunchSteps className="mt-5 sm:mt-6 lg:grid-cols-2" />
      <p className="mt-4 border-l-2 border-ink pl-4 text-sm leading-6 font-bold text-foreground">
        {DFY_LAUNCH.yourPart}
      </p>
    </Section>
  )
}
