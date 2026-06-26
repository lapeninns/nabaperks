"use client"

import { useEffect, useState, type ReactNode } from "react"

import {
  CheckmarkBadge04Icon,
  GiftIcon,
  QrCode01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"

import { Eyebrow, Icon, type IconGlyph } from "@/components/brand"
import { DemoQr } from "@/components/marketing/demo-qr"
import {
  MARKETING_DEMO_INITIALS,
  MARKETING_DEMO_OTP,
  MARKETING_DEMO_PHONE,
  MARKETING_DEMO_POSTCODE,
  MARKETING_DEMO_VENUE,
} from "@/components/marketing/marketing-demo"
import { MarketingQrScanOverlay } from "@/components/marketing/marketing-qr-scan-overlay"
import { MysteryRewardGift } from "@/components/marketing/mystery-reward-gift"
import {
  SOLUTION_STAMP_TOTAL,
  SOLUTION_STORY_TIMING,
  solutionPhaseToPhoneScreen,
  solutionStoryCopy,
  solutionStoryStepIndex,
  type PhoneStoryScreen,
  type SolutionStoryPhase,
  type SolutionStoryStep,
  useSolutionStoryLoop,
} from "@/components/marketing/use-solution-story-loop"
import { RewardSeal, StampGrid } from "@/components/loyalty"
import { WetInkBreathe, WetInkRise } from "@/components/motion"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { cn } from "@/lib/utils"

const PHONE_EASE = [0.22, 1, 0.36, 1] as const

function phoneMotion(
  reduce: boolean,
  duration = 0.38
) {
  if (reduce) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    }
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration, ease: PHONE_EASE },
  }
}

const PHONE_STEP_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 34,
}

const STEPS: {
  id: SolutionStoryStep
  n: string
  title: string
  icon: IconGlyph
  blurb: string
}[] = [
  {
    id: "scan",
    n: "01",
    title: "Scan",
    icon: QrCode01Icon,
    blurb: "The permanent venue QR opens the card in the browser.",
  },
  {
    id: "save",
    n: "02",
    title: "Save",
    icon: UserAdd01Icon,
    blurb: "One text confirms the number. No app or password.",
  },
  {
    id: "stamp",
    n: "03",
    title: "Stamp",
    icon: CheckmarkBadge04Icon,
    blurb: "The customer taps once. One stamp per UK business day.",
  },
  {
    id: "collect",
    n: "04",
    title: "Reward",
    icon: GiftIcon,
    blurb: "The mystery reward unlocks for one merchant-scanned collection.",
  },
]

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label="Customer loyalty flow on a phone"
      className="mx-auto w-full max-w-[15.5rem]"
    >
      <div className="rounded-[2rem] border-2 border-ink bg-ink p-1.5 shadow-sm">
        <div className="overflow-hidden rounded-[1.55rem] border border-ink/15 bg-background">
          <div className="flex h-6 items-center justify-center bg-ink/[0.04]">
            <span className="h-1 w-10 rounded-full bg-ink/15" />
          </div>
          <div className="grid min-h-[22rem] content-start gap-3 p-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneStepRail({ activeStep }: { activeStep: SolutionStoryStep }) {
  return (
    <LayoutGroup id="how-it-works-phone-rail">
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map((step) => {
          const active = activeStep === step.id
          return (
            <span
              key={step.id}
              className="relative grid place-items-center pb-1.5 text-center"
            >
              <span
                className={cn(
                  "font-mono text-[0.5rem] font-bold tracking-[0.05em] uppercase transition-colors duration-300 ease-[var(--w-ease)] motion-reduce:transition-none",
                  active ? "text-foreground" : "text-muted-foreground/65"
                )}
              >
                {step.title}
              </span>
              {active ? (
                <motion.span
                  layoutId="how-it-works-step-pip"
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-primary"
                  transition={PHONE_STEP_SPRING}
                />
              ) : null}
            </span>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function PhoneActiveStep({
  step,
  reduce,
}: {
  step: (typeof STEPS)[number]
  reduce: boolean
}) {
  const motionProps = phoneMotion(reduce)

  return (
    <div className="relative min-h-[4.35rem] overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          {...motionProps}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 rounded-lg border-2 border-ink bg-card p-2.5 shadow-xs"
        >
          <motion.span
            className="grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-primary-foreground shadow-sm"
            initial={reduce ? false : { scale: 0.88, rotate: -10 }}
            animate={{ scale: 1, rotate: -6 }}
            transition={reduce ? { duration: 0 } : PHONE_STEP_SPRING}
          >
            <Icon icon={step.icon} size={17} strokeWidth={2.25} />
          </motion.span>
          <div className="min-w-0 grid gap-0.5">
            <span className="font-mono text-[0.62rem] font-bold tracking-[0.08em] text-foreground uppercase">
              {step.n} · {step.title}
            </span>
            <p className="text-[0.68rem] leading-4 font-bold text-pretty text-muted-foreground">
              {step.blurb}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function PhoneScanScreen() {
  return (
    <div className="relative flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-ink/[0.03] p-4">
      <WetInkBreathe active className="relative">
        <div className="relative rounded-md border-2 border-primary bg-white p-2 shadow-[3px_3px_0_var(--primary)]">
          <DemoQr className="grid aspect-square w-[4.25rem] grid-cols-10 gap-[2px] rounded-sm bg-white p-1" />
          <MarketingQrScanOverlay active className="rounded-md" />
        </div>
      </WetInkBreathe>
    </div>
  )
}

function PhoneSaveScreen({ reduce }: { reduce: boolean }) {
  const [revealedCount, setRevealedCount] = useState(
    reduce ? MARKETING_DEMO_OTP.length : 0
  )

  useEffect(() => {
    if (reduce) {
      setRevealedCount(MARKETING_DEMO_OTP.length)
      return
    }

    let cancelled = false
    const timeouts = new Set<ReturnType<typeof setTimeout>>()

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        timeouts.delete(id)
        if (!cancelled) fn()
      }, delay)
      timeouts.add(id)
    }

    setRevealedCount(0)

    MARKETING_DEMO_OTP.forEach((_, index) => {
      schedule(
        () => setRevealedCount(index + 1),
        SOLUTION_STORY_TIMING.saveOtpStartDelayMs +
          index * SOLUTION_STORY_TIMING.saveOtpDigitMs
      )
    })

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [reduce])

  return (
    <div className="grid h-full gap-2.5">
      <Eyebrow>{MARKETING_DEMO_VENUE}</Eyebrow>
      <p className="text-sm leading-tight font-extrabold text-pretty">
        Save my card
      </p>
      <label className="grid gap-1">
        <span className="font-mono text-[0.58rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Mobile number
        </span>
        <span className="rounded-md border-2 border-ink bg-card px-2.5 py-2 font-mono text-xs font-bold">
          {MARKETING_DEMO_PHONE}
        </span>
      </label>
      <div className="grid gap-1">
        <span
          className={cn(
            "font-mono text-[0.58rem] font-bold tracking-[0.08em] uppercase transition-colors duration-300 ease-[var(--w-ease)] motion-reduce:transition-none",
            revealedCount > 0 ? "text-foreground" : "text-muted-foreground"
          )}
        >
          One text code
        </span>
        <div className="grid grid-cols-6 gap-1">
          {MARKETING_DEMO_OTP.map((digit, index) => {
            const revealed = index < revealedCount
            return (
              <motion.span
                key={`otp-${index}`}
                className="grid aspect-square place-items-center rounded-md border-2 border-ink bg-card text-xs font-extrabold"
                initial={false}
                animate={
                  reduce
                    ? { scale: 1, opacity: 1 }
                    : revealed
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0.94, opacity: 0.28 }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 520,
                        damping: 28,
                      }
                }
              >
                {revealed ? digit : ""}
              </motion.span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PhoneCardScreen({
  earnedCount,
  slamIndex,
  stampTotal,
  phase,
}: {
  earnedCount: number
  slamIndex: number
  stampTotal: number
  phase: SolutionStoryPhase
}) {
  return (
    <div className="grid h-full gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 grid gap-0.5">
          <Eyebrow>
            {MARKETING_DEMO_VENUE} · {MARKETING_DEMO_POSTCODE}
          </Eyebrow>
          <p className="text-xs leading-tight font-extrabold text-pretty">
            Mystery reward after {stampTotal} visits
          </p>
        </div>
        <span className="grid size-7 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-card text-[0.6rem] font-extrabold shadow-xs">
          {MARKETING_DEMO_INITIALS}
        </span>
      </div>
      <StampGrid
        current={earnedCount}
        total={stampTotal}
        slamIndex={slamIndex}
        venueName={MARKETING_DEMO_VENUE}
        venueInitials={MARKETING_DEMO_INITIALS}
        showEmptySlotNumbers={earnedCount === 0}
        compact
        className="mx-auto w-full max-w-[10.5rem]"
      />
      <RewardSeal
        state="sealed"
        size="sm"
        label="Mystery reward, sealed"
        wiggle={phase === "stamping"}
        className="justify-self-start"
      />
    </div>
  )
}

function PhoneRewardScreen({
  revealSlam,
  breathe,
}: {
  revealSlam: boolean
  breathe: boolean
}) {
  return (
    <div className="grid h-full place-content-center py-2">
      <MysteryRewardGift
        size="md"
        slammed={revealSlam}
        breathe={breathe}
        label="Mystery reward"
        className="mx-auto"
      />
    </div>
  )
}

function PhoneStory({
  screen,
  phase,
  earnedCount,
  slamIndex,
  stampTotal,
  revealSlam,
  reduce,
}: {
  screen: PhoneStoryScreen
  phase: SolutionStoryPhase
  earnedCount: number
  slamIndex: number
  stampTotal: number
  revealSlam: boolean
  reduce: boolean
}) {
  if (screen === "scan") return <PhoneScanScreen />
  if (screen === "save") return <PhoneSaveScreen reduce={reduce} />
  if (screen === "card") {
    return (
      <PhoneCardScreen
        earnedCount={earnedCount}
        slamIndex={slamIndex}
        stampTotal={stampTotal}
        phase={phase}
      />
    )
  }
  return (
    <PhoneRewardScreen
      revealSlam={revealSlam}
      breathe={phase === "collect"}
    />
  )
}

function PhoneStoryCaption({
  captionKey,
  rewardNote,
  reduce,
}: {
  captionKey: string
  rewardNote: string
  reduce: boolean
}) {
  const motionProps = phoneMotion(reduce, 0.3)

  return (
    <div
      aria-live="polite"
      className="relative min-h-[2.25rem] overflow-hidden border-t border-dashed border-border pt-2"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={captionKey}
          {...motionProps}
          className="text-center font-mono text-[0.52rem] font-bold tracking-[0.06em] text-pretty text-muted-foreground uppercase"
        >
          {rewardNote}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

/** How-it-works beat — looping phone story with in-screen step copy. */
export function MarketingHowItWorksSection() {
  const reduceMotion = useReducedMotionHook()
  const { phase, earnedCount, slamIndex, revealSlam, stampTotal } =
    useSolutionStoryLoop(SOLUTION_STAMP_TOTAL)
  const copy = solutionStoryCopy({ phase, earnedCount, stampTotal })
  const activeStep = copy.activeStep
  const activeStepDef = STEPS[solutionStoryStepIndex(activeStep)]!
  const screen = solutionPhaseToPhoneScreen(phase)
  const screenMotion = phoneMotion(reduceMotion, 0.42)
  const captionKey = `${phase}-${earnedCount}`

  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-12 lg:py-14"
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:items-center lg:gap-14">
        <div className="min-w-0 grid gap-3">
          <Eyebrow>The counter flow</Eyebrow>
          <h2 className="max-w-[18ch] text-[clamp(1.8rem,6vw,2.7rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
            Scan, save, stamp, reward.
          </h2>
          <p className="max-w-[44ch] text-sm leading-6 text-muted-foreground sm:text-base">
            The customer keeps their phone. Your team keeps the queue moving.
            One scan, one text, one tap — then the mystery reward at the
            counter.
          </p>
        </div>

        <WetInkRise className="w-full min-w-0 lg:justify-self-end" delay={0.04}>
          <PhoneFrame>
            <PhoneStepRail activeStep={activeStep} />
            <PhoneActiveStep step={activeStepDef} reduce={reduceMotion} />
            <div className="relative h-[11.5rem] overflow-hidden">
              <AnimatePresence initial={false}>
                <motion.div
                  key={screen}
                  className="absolute inset-0"
                  {...screenMotion}
                >
                  <PhoneStory
                    screen={screen}
                    phase={phase}
                    earnedCount={earnedCount}
                    slamIndex={slamIndex}
                    stampTotal={stampTotal}
                    revealSlam={revealSlam}
                    reduce={reduceMotion}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <PhoneStoryCaption
              captionKey={captionKey}
              rewardNote={copy.rewardNote}
              reduce={reduceMotion}
            />
          </PhoneFrame>
        </WetInkRise>
      </div>
    </section>
  )
}
