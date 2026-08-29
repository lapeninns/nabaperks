import {
  GiftIcon,
  MagicWand01Icon,
  PrinterIcon,
  Rocket01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

import { IconRoundel, MonoTag, SectionHeader } from "@/components/brand"
import type { IconGlyph } from "@/components/brand/icon"
import { Section } from "@/components/layout"
import { DFY_LAUNCH } from "@/lib/marketing/facts"

/**
 * Step glyphs in launch order — one per DFY_LAUNCH step (the offer contract
 * locks the master-doc sequence at five; the last step is the venue's own
 * go-live). Shared by the process hero's launch ticket so both renderings of
 * the sequence carry the same glyph.
 */
export const LAUNCH_STEP_GLYPHS: readonly IconGlyph[] = [
  Store01Icon,
  GiftIcon,
  MagicWand01Icon,
  PrinterIcon,
  Rocket01Icon,
]

/**
 * The done-for-you launch sequence as a print timeline. Below `sm:` it hangs
 * vertically off a dashed tear line, each roundel the stamp that marks its
 * step. From `sm:` up it turns horizontal — two-up, then five-up from `lg:` —
 * because five full-width cards stacked vertically was ~1,250px, the single
 * tallest block on `/how-it-works`, for five short steps that are a SEQUENCE:
 * the horizontal relationship is the meaning.
 *
 * Steps one to four wear the "Done for you" tag; the fifth turns primary and
 * hands over to the venue. The venue's own part closes the band in a dashed
 * well. Shared by the landing page's offer story and the how-it-works page so
 * the sequence can never fork.
 */
export function LaunchSteps() {
  const lastIndex = DFY_LAUNCH.steps.length - 1

  return (
    <Section id="launch" size="dense">
      <SectionHeader
        size="band"
        eyebrow="The launch sequence"
        title="Five steps — four of them ours"
        description={DFY_LAUNCH.intro}
      />
      <ol className="grid gap-3.5 pt-5 sm:grid-cols-2 sm:gap-4 sm:pt-6 lg:grid-cols-5">
        {DFY_LAUNCH.steps.map((step, index) => {
          const last = index === lastIndex

          return (
            <li
              key={step.title}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-4 sm:grid-cols-1 sm:gap-3"
            >
              <div className="grid justify-items-center sm:justify-items-start">
                <IconRoundel
                  size="md"
                  tone={last ? "primary" : "secondary"}
                  icon={LAUNCH_STEP_GLYPHS[index]}
                />
                {/* The tear line only exists in the vertical arrangement. */}
                {last ? null : (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 w-0 flex-1 border-l-2 border-dashed border-line-strong sm:hidden"
                  />
                )}
              </div>
              <div className="grid h-full content-start gap-2 rounded-lg border-2 border-ink bg-card p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <MonoTag tone={last ? "accent" : "plain"}>
                    {last ? "You go live" : "Done for you"}
                  </MonoTag>
                  <span className="mono-id text-muted-foreground uppercase">
                    Step {index + 1} of {DFY_LAUNCH.steps.length}
                  </span>
                </div>
                <h3 className="text-base leading-snug font-extrabold text-foreground sm:text-lg">
                  {step.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="mt-4 grid gap-1 rounded-lg border-2 border-dashed border-line-strong bg-card p-4 sm:mt-5">
        <p className="text-sm leading-6 font-bold text-foreground">
          {DFY_LAUNCH.yourPart}
        </p>
      </div>
    </Section>
  )
}
