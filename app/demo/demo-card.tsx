"use client"

import { useState } from "react"

import { ReceiptCard } from "@/components/brand"
import { StampGrid } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { SEALED_REWARD_NOTE } from "@/lib/copy/product-copy"

const TOTAL_STAMPS = 5

/**
 * Interactive marketing demo of the browser loyalty card — the recommended
 * 5-stamp cycle with the sealed mystery reward at the end. A toy on purpose:
 * the copy says plainly that real stamps are venue-issued and server-verified.
 */
export function DemoCard() {
  const [count, setCount] = useState(0)
  const [slamIndex, setSlamIndex] = useState(-1)
  const complete = count >= TOTAL_STAMPS

  function addStamp() {
    if (complete) {
      return
    }
    setSlamIndex(count)
    setCount(count + 1)
  }

  function reset() {
    setCount(0)
    setSlamIndex(-1)
  }

  return (
    <ReceiptCard edge padding="md" className="gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono-meta text-muted-foreground">Demo card</span>
        <span className="mono-id text-muted-foreground">Your venue</span>
      </div>
      <StampGrid
        current={count}
        total={TOTAL_STAMPS}
        slamIndex={slamIndex}
        showEmptySlotNumbers
        rewardSlot={complete ? "ready" : "locked"}
        showCount
      />
      <p
        aria-live="polite"
        className="text-sm leading-6 font-bold text-foreground"
      >
        {complete
          ? "Card complete. The mystery reward is ready for a merchant scan."
          : `${count} of ${TOTAL_STAMPS} stamps collected.`}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {SEALED_REWARD_NOTE}
      </p>
      <div className="flex flex-wrap gap-3 border-t-2 border-dashed border-border pt-4">
        <Button onClick={addStamp} disabled={complete}>
          Add a stamp
        </Button>
        {count > 0 ? (
          <Button variant="ghost" onClick={reset}>
            Start again
          </Button>
        ) : null}
      </div>
    </ReceiptCard>
  )
}
