"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"

import { VenueMark } from "@/components/brand"
import { StampSlamSequence, WetInkSlam } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { wetInkTransition } from "@/lib/motion/tokens"
import { cn } from "@/lib/utils"

import {
  DEFAULT_VENUE_PROOF_INDICES,
  shuffleVenueProofIndices,
  venueProofSignoff,
  type VenueProofEntry,
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
        "max-sm:w-[min(19rem,84vw)] max-sm:shrink-0 max-sm:snap-start sm:min-w-0 sm:w-full",
        RECEIPT_TILTS[tiltIndex % RECEIPT_TILTS.length]
      )}
    >
      <StampSlamSequence
        active={shakeActive}
        className="[filter:drop-shadow(3px_3px_0_var(--w-shadow-color))]"
      >
        <div className="rounded-t-[var(--radius)] border-2 border-b-0 border-ink bg-card px-4 pt-3.5 pb-3">
          <figcaption>
            <p className="eyebrow text-primary">Independent pub</p>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-extrabold text-balance">
                  {venue.name}
                </span>
                <span className="mono-id mt-0.5 block font-normal text-muted-foreground">
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

          <blockquote className="text-[0.8125rem] leading-[1.45] font-extrabold text-pretty">
            {venue.review}
          </blockquote>

          <hr className="w-rule !my-2.5" />

          <p className="mono-id font-normal text-muted-foreground">
            {venueProofSignoff(venue)}
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
        "max-sm:w-[min(11rem,46vw)] max-sm:shrink-0 max-sm:snap-start sm:min-w-0 sm:w-full",
        "-rotate-[0.5deg]"
      )}
    >
      <div className="flex flex-col justify-between gap-3 rounded-t-[var(--radius)] border-2 border-b-0 border-dashed border-ink/45 bg-card px-3.5 py-3.5 shadow-xs">
        <p className="eyebrow text-muted-foreground">More venues</p>
        <p className="text-sm leading-snug font-extrabold text-pretty">
          Other pubs and cafes on Nabaperks.
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

/**
 * Three venue quotes per view, with See more to shuffle in another three-pack.
 * The first three render from `initialIndices` on the server; shuffle is client-only.
 */
export function VenueProofReviews({
  initialIndices = DEFAULT_VENUE_PROOF_INDICES,
}: {
  initialIndices?: readonly number[]
}) {
  const reduce = useReducedMotionHook()
  const [venues, setVenues] = useState<VenueProofEntry[]>(() =>
    venuesForIndices(initialIndices)
  )
  const [activeIndices, setActiveIndices] = useState<number[]>(() => [
    ...initialIndices,
  ])
  const [shuffleGeneration, setShuffleGeneration] = useState(0)
  const ribbonRef = useRef<HTMLDivElement>(null)
  const firstCardRef = useRef<HTMLElement>(null)

  const scrollToFirstCard = useCallback(() => {
    if (window.matchMedia("(min-width: 640px)").matches) return

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
      // `scroll-snap-type` must sit on the scroll container — on the inner
      // `w-max` track it is inert (the track never scrolls).
      className="min-w-0 overflow-x-auto overflow-y-hidden py-1 [-ms-overflow-style:none] [scrollbar-width:none] max-sm:snap-x max-sm:snap-proximity sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-live="polite"
    >
      <div className="flex w-max max-w-full items-start gap-3 pb-1 max-sm:pe-1 sm:grid sm:w-full sm:grid-cols-2 sm:gap-4 sm:pb-0 lg:grid-cols-4 xl:grid-cols-2 xl:gap-3">
        {venues.map((venue, index) => (
          <VenueReviewReceipt
            key={`${shuffleGeneration}-${venue.name}`}
            ref={index === 0 ? firstCardRef : undefined}
            venue={venue}
            tiltIndex={index}
          />
        ))}
        <VenueProofSeeMore onShuffle={handleShuffle} />
      </div>
    </div>
  )
}

/** Static fallback for tests and reduced-motion SSR hints. */
export const venueProofPreview = venuesForIndices(DEFAULT_VENUE_PROOF_INDICES)
