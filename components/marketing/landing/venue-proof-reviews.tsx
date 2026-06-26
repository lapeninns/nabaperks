"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"

import { VenueMark } from "@/components/brand"
import { StampSlamSequence, WetInkSlam } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { wetInkTransition } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

import {
  pickVenueProofIndices,
  shuffleVenueProofIndices,
  type VenueProofEntry,
  venueProofPool,
  venuesForIndices,
} from "./venue-proof-data"

const RECEIPT_TILTS = ["rotate-[0.7deg]", "-rotate-[0.9deg]", "rotate-[1.1deg]", "-rotate-[0.6deg]"] as const
const STAMP_STAGGER_MS = 420
const STAMP_LOOP_MS = 5_600
const STAMP_MARK_TILTS = ["-6deg", "-7deg", "-5deg", "-8deg"] as const

function StampingVenueMark({
  name,
  size,
  tiltIndex,
  onSlamComplete,
}: {
  name: string
  size: number
  tiltIndex: number
  onSlamComplete?: () => void
}) {
  const reduce = useReducedMotionHook()
  const [slamBeat, setSlamBeat] = useState(0)

  useEffect(() => {
    if (reduce) return

    let cancelled = false
    const timeouts = new Set<ReturnType<typeof setTimeout>>()

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        timeouts.delete(id)
        if (!cancelled) fn()
      }, delay)
      timeouts.add(id)
    }

    const stamp = () => {
      setSlamBeat((beat) => beat + 1)
      schedule(stamp, STAMP_LOOP_MS)
    }

    schedule(stamp, 520 + tiltIndex * STAMP_STAGGER_MS)

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [reduce, tiltIndex])

  const mark = <VenueMark name={name} size={size} className="shrink-0" />

  if (reduce) {
    return (
      <span
        className="inline-block shrink-0"
        style={{ rotate: STAMP_MARK_TILTS[tiltIndex % STAMP_MARK_TILTS.length] }}
      >
        {mark}
      </span>
    )
  }

  return (
    <WetInkSlam
      key={slamBeat}
      active={slamBeat > 0}
      className="inline-block shrink-0"
      style={{ rotate: STAMP_MARK_TILTS[tiltIndex % STAMP_MARK_TILTS.length] }}
      onComplete={onSlamComplete}
    >
      {mark}
    </WetInkSlam>
  )
}

const VenueReviewReceipt = forwardRef<
  HTMLElement,
  {
    venue: VenueProofEntry
    tiltIndex: number
  }
>(function VenueReviewReceipt({ venue, tiltIndex }, ref) {
  const reduce = useReducedMotionHook()
  const [shakeActive, setShakeActive] = useState(false)

  const handleSlamComplete = useCallback(() => {
    if (reduce) return
    setShakeActive(true)
    window.setTimeout(
      () => setShakeActive(false),
      wetInkTransition.shake.duration * 1000
    )
  }, [reduce])

  return (
    <figure
      ref={ref}
      className={cn(
        "w-[min(15.5rem,72vw)] shrink-0 snap-start lg:w-auto lg:shrink",
        RECEIPT_TILTS[tiltIndex % RECEIPT_TILTS.length]
      )}
    >
      <StampSlamSequence
        active={shakeActive}
        className="[filter:drop-shadow(3px_3px_0_var(--w-shadow-color))]"
      >
        <div className="rounded-t-[var(--radius)] border-2 border-b-0 border-ink bg-card px-3.5 pt-3 pb-2.5">
          <figcaption>
            <p className="eyebrow text-primary">Operator note</p>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-extrabold text-balance">
                  {venue.name}
                </span>
                <span className="mt-0.5 block font-mono text-[0.62rem] tracking-[0.06em] text-muted-foreground uppercase">
                  {venue.postcode}
                </span>
              </span>
              <StampingVenueMark
                name={venue.name}
                size={30}
                tiltIndex={tiltIndex}
                onSlamComplete={handleSlamComplete}
              />
            </div>
          </figcaption>

          <hr className="w-rule !my-2.5" />

          <blockquote className="line-clamp-3 text-[0.8rem] leading-5 font-extrabold text-pretty">
            {venue.review}
          </blockquote>

          <hr className="w-rule !my-2.5" />

          <p className="font-mono text-[0.58rem] tracking-[0.06em] text-muted-foreground uppercase">
            From the venue team
          </p>
        </div>
        <div aria-hidden="true" className="receipt-edge" />
      </StampSlamSequence>
    </figure>
  )
})

function VenueProofSeeMore({ onShuffle }: { onShuffle: () => void }) {
  return (
    <div
      className={cn(
        "w-[min(9.5rem,42vw)] shrink-0 snap-start lg:w-auto",
        "-rotate-[0.5deg]"
      )}
    >
      <div className="flex min-h-[7.75rem] flex-col justify-between rounded-t-[var(--radius)] border-2 border-b-0 border-dashed border-ink/45 bg-card px-3 py-3 shadow-xs">
        <p className="eyebrow text-muted-foreground">Venue voices</p>
        <p className="text-sm leading-snug font-extrabold text-pretty">
          Pull three more operator notes from the network.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onShuffle}
          className="w-full"
        >
          See more
        </Button>
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  )
}

function VenueProofQuotesSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          className={cn(
            "w-[min(15.5rem,72vw)] shrink-0 lg:w-auto",
            RECEIPT_TILTS[index % RECEIPT_TILTS.length]
          )}
        >
          <div className="h-[7.5rem] animate-pulse rounded-t-[var(--radius)] border-2 border-b-0 border-ink/30 bg-muted/25" />
          <div aria-hidden className="receipt-edge opacity-40" />
        </div>
      ))}
    </>
  )
}

/**
 * Three venue quotes per view, with See more to shuffle in another three-pack.
 */
export function VenueProofReviews() {
  const reduce = useReducedMotionHook()
  const [venues, setVenues] = useState<VenueProofEntry[] | null>(null)
  const [activeIndices, setActiveIndices] = useState<number[]>([])
  const [shuffleGeneration, setShuffleGeneration] = useState(0)
  const ribbonRef = useRef<HTMLDivElement>(null)
  const firstCardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const indices = pickVenueProofIndices()
    setActiveIndices(indices)
    setVenues(venuesForIndices(indices))
  }, [])

  const scrollToFirstCard = useCallback(() => {
    const ribbon = ribbonRef.current
    const firstCard = firstCardRef.current
    const behavior = reduce ? ("instant" as const) : ("smooth" as const)

    ribbon?.scrollTo({ left: 0, behavior })
    firstCard?.scrollIntoView({
      behavior,
      inline: "start",
      block: "nearest",
    })
  }, [reduce])

  const handleShuffle = useCallback(() => {
    const nextIndices = shuffleVenueProofIndices(activeIndices)
    setActiveIndices(nextIndices)
    setVenues(venuesForIndices(nextIndices))
    setShuffleGeneration((generation) => generation + 1)
  }, [activeIndices])

  useEffect(() => {
    if (shuffleGeneration === 0) return
    const frame = window.requestAnimationFrame(() => {
      scrollToFirstCard()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [shuffleGeneration, scrollToFirstCard])

  return (
    <div
      ref={ribbonRef}
      className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      aria-busy={venues === null}
      aria-live="polite"
    >
      {venues === null ? (
        <VenueProofQuotesSkeleton />
      ) : (
        <>
          {venues.map((venue, index) => (
            <VenueReviewReceipt
              key={`${shuffleGeneration}-${venue.name}`}
              ref={index === 0 ? firstCardRef : undefined}
              venue={venue}
              tiltIndex={index}
            />
          ))}
          <VenueProofSeeMore onShuffle={handleShuffle} />
        </>
      )}
    </div>
  )
}

/** Static fallback for tests and reduced-motion SSR hints. */
export const venueProofPreview = venueProofPool.slice(0, 3)
