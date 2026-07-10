"use client"

import { useCallback, useRef, useState, type KeyboardEvent } from "react"

import { RewardTicket } from "@/components/loyalty"
import { SampleLoyaltyCard } from "@/components/marketing/landing/sample-loyalty-card"
import { Button } from "@/components/ui/button"
import { stampDisplayDatesEndingToday } from "@/lib/customer/uk-calendar"
import { cn } from "@/lib/utils"

/** Three stamps — the reward lands in a few taps, quick enough to feel the loop. */
const TOTAL = 3
const REWARD = "A coffee on the house"

/**
 * The live demo — the real customer card, driven by taps instead of a counter
 * scan. The card itself is the stamp surface (WCAG 2.1.1: role="button" with
 * Enter/Space), reusing the genuine SampleLoyaltyCard / StampGrid / RewardTicket
 * so what a prospect stamps here is what their regulars get. Pure client state:
 * nothing is saved and no membership is created.
 */
export function DemoCard() {
  const [dates] = useState(() => stampDisplayDatesEndingToday(TOTAL))
  const [current, setCurrent] = useState(0)
  const [slamIndex, setSlamIndex] = useState(-1)
  const slamTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const complete = current >= TOTAL
  const remaining = TOTAL - current

  const addStamp = useCallback(() => {
    setCurrent((n) => {
      if (n >= TOTAL) return n
      // Slam the slot that just filled, then release it so a replay re-fires.
      setSlamIndex(n)
      if (slamTimer.current) clearTimeout(slamTimer.current)
      slamTimer.current = setTimeout(() => setSlamIndex(-1), 450)
      return n + 1
    })
  }, [])

  const reset = useCallback(() => {
    if (slamTimer.current) clearTimeout(slamTimer.current)
    setSlamIndex(-1)
    setCurrent(0)
  }, [])

  const onCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        addStamp()
      }
    },
    [addStamp]
  )

  return (
    <div className="grid gap-4">
      <div
        {...(complete
          ? {}
          : {
              role: "button" as const,
              tabIndex: 0,
              "aria-label": `Add a stamp. ${current} of ${TOTAL} collected.`,
              onClick: addStamp,
              onKeyDown: onCardKeyDown,
            })}
        className={cn(
          "focus-ring mx-auto w-full max-w-[21rem] rounded-2xl transition-transform duration-150",
          !complete &&
            "cursor-pointer select-none active:translate-y-px motion-safe:hover:-translate-y-0.5"
        )}
      >
        <SampleLoyaltyCard
          className="rotate-[-1deg]"
          venue="A sample café · demo"
          title="Coffee loyalty card"
          venueInitials="SC"
          stamps={{ current, total: TOTAL, dates: dates.slice(0, current) }}
          slamIndex={slamIndex}
          footerLeft="Demo — nothing saved"
          footerRight={`${current} / ${TOTAL} stamps`}
        >
          <RewardTicket
            state={complete ? "ready" : "sealed"}
            name={complete ? REWARD : "Something's brewing."}
            description={
              complete
                ? "Show this at the counter to redeem."
                : "Fill the card to reveal your reward."
            }
            sealSlammed={complete}
          />
        </SampleLoyaltyCard>
      </div>

      <p
        aria-live="polite"
        className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm leading-6 font-medium text-foreground"
      >
        {complete ? (
          "Reward unlocked — that's the whole loop, no app in sight."
        ) : (
          <>
            <span
              aria-hidden="true"
              className="text-primary motion-safe:animate-pulse"
            >
              &uarr;
            </span>
            <span>Tap the card to add a stamp</span>
            <span className="font-normal text-muted-foreground">
              &middot; {remaining} to go
            </span>
          </>
        )}
      </p>

      {complete ? (
        <Button
          variant="outline"
          size="lg"
          onClick={reset}
          className="mx-auto w-full max-w-[21rem]"
        >
          Reset the demo
        </Button>
      ) : null}
    </div>
  )
}
