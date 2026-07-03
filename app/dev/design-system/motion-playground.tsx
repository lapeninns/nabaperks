"use client"

import { type ReactNode, useState } from "react"

import { ReceiptCard } from "@/components/brand"
import { RewardSeal } from "@/components/loyalty"
import { StampDot } from "@/components/loyalty/stamp-grid"
import { Marquee } from "@/components/marketing/marquee"
import {
  StampCelebration,
  StampSlamSequence,
  WetInkPop,
  WetInkRipple,
  WetInkRise,
  WetInkSheet,
  WetInkSoftStamp,
} from "@/components/motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Live motion gallery for the design-system catalog. Each card re-mounts its
 * motion child on "Replay" (via the `nonce` key) so one-shot beats fire cleanly;
 * looping beats (wiggle) run continuously. Every primitive renders static
 * children under `prefers-reduced-motion`, so this is also the reduced-motion
 * acceptance surface — nothing here ever blanks out.
 */
function MotionDemo({
  name,
  blurb,
  children,
}: {
  name: string
  blurb: string
  children: (nonce: number) => ReactNode
}) {
  const [nonce, setNonce] = useState(0)

  return (
    <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="mono-meta text-foreground">{name}</span>
          <span className="text-xs leading-5 text-muted-foreground">
            {blurb}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setNonce((value) => value + 1)}
        >
          Replay
        </Button>
      </div>
      <div className="grid min-h-28 place-items-center overflow-hidden rounded-md bg-paper p-4">
        {children(nonce)}
      </div>
    </div>
  )
}

function Chip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-md border-2 border-ink bg-card px-4 py-2 text-sm font-extrabold shadow-xs",
        className
      )}
    >
      {children}
    </span>
  )
}

export function MotionPlayground() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MotionDemo
        name="WetInkRise"
        blurb="Standard entrance — rises 14px into place."
      >
        {(nonce) => (
          <WetInkRise key={nonce}>
            <Chip>Rises in</Chip>
          </WetInkRise>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkRise inView"
        blurb="Section entrance — rises once when the row enters the viewport."
      >
        {(nonce) => (
          <WetInkRise key={nonce} inView distance={12}>
            <Chip>Viewport rise</Chip>
          </WetInkRise>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkSlam"
        blurb="Stamp landing — overshoots onto the resting tilt."
      >
        {(nonce) => (
          <div key={nonce} className="w-14">
            <StampDot
              earned
              slammed
              label="Stamp 3 earned"
              venueName="The Old Crown"
            />
          </div>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkSoftStamp"
        blurb="Gentler slam for previews — no overshoot."
      >
        {(nonce) => (
          <WetInkSoftStamp key={nonce} active>
            <Chip>Soft stamp</Chip>
          </WetInkSoftStamp>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkShake"
        blurb="Paper jitter — rides along with a slam."
      >
        {(nonce) => (
          <ReceiptCard key={nonce} shaken className="w-full max-w-56 p-4">
            <p className="text-sm font-extrabold">That is one stamp</p>
            <p className="text-xs leading-5 text-muted-foreground">
              The receipt shudders as the ink lands.
            </p>
          </ReceiptCard>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkPop"
        blurb="Reward reveal — scale springs with overshoot."
      >
        {(nonce) => (
          <WetInkPop key={nonce} active>
            <Chip className="bg-reward text-reward-foreground">Pop</Chip>
          </WetInkPop>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkWiggle"
        blurb="Idle tease — reserved for the sealed mystery."
      >
        {() => <RewardSeal state="sealed" size="lg" wiggle />}
      </MotionDemo>

      <MotionDemo
        name="WetInkBreathe"
        blurb="Resting pulse — the unlocked reward breathes while it waits, and again once it is ready at the counter."
      >
        {() => <RewardSeal state="waiting" size="lg" breathe />}
      </MotionDemo>

      <MotionDemo
        name="WetInkRipple"
        blurb="Expanding fade ring behind a celebration beat."
      >
        {(nonce) => (
          <span className="relative grid size-16 place-items-center">
            <WetInkRipple
              key={nonce}
              active
              className="absolute inset-0 rounded-full border-2 border-ink bg-reward/30"
            />
            <RewardSeal state="ready" size="md" />
          </span>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkSheet"
        blurb="Bottom-sheet entrance — slides up from below."
      >
        {(nonce) => (
          <WetInkSheet key={nonce} className="w-full max-w-56">
            <div className="rounded-t-xl border-2 border-ink bg-card p-4">
              <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-ink/30" />
              <p className="text-sm font-extrabold">Sheet content</p>
            </div>
          </WetInkSheet>
        )}
      </MotionDemo>

      <MotionDemo
        name="StampSlamSequence"
        blurb="Composed beat — slam on the dot, shake on the receipt."
      >
        {(nonce) => (
          <StampSlamSequence key={nonce} active className="w-full max-w-56">
            <ReceiptCard className="grid justify-items-start gap-2 p-4">
              <p className="text-xs font-extrabold">The Old Crown</p>
              <div className="w-12">
                <StampDot
                  earned
                  slammed
                  label="Stamp 3 earned"
                  venueName="The Old Crown"
                />
              </div>
            </ReceiptCard>
          </StampSlamSequence>
        )}
      </MotionDemo>

      <MotionDemo
        name="StampCelebration"
        blurb="Stamp burst — entry rise with confetti ring of ink dots."
      >
        {(nonce) => (
          <StampCelebration key={nonce}>
            <Chip className="bg-stamp text-stamp-foreground">Stamped</Chip>
          </StampCelebration>
        )}
      </MotionDemo>

      <MotionDemo
        name="WetInkMarquee"
        blurb="Horizontal riso strip — infinite linear scroll; holds still under reduced motion."
      >
        {() => (
          <Marquee
            items={["No app", "No plastic", "Stamped in seconds"]}
            className="w-full"
          />
        )}
      </MotionDemo>
    </div>
  )
}
