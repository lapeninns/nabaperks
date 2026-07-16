"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, Icon } from "@/components/brand"
import { PosterThumbnail } from "@/components/merchant/qr-poster/poster-thumbnail"
import { Button } from "@/components/ui/button"
import {
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

const POSTER_USE_CASE: Record<QrPosterTemplateId, string> = {
  editorial: "Calm café or dining room",
  bold: "Busy bar or high-traffic counter",
  ticket: "Promotional launch",
  northstar: "Dark pub or evening venue",
  thermal: "Compact till display",
  "table-tent": "Dining tables / outdoor seating",
}

export function SwipePosterPicker({
  initialTemplate,
  qrDataUrl,
  venueName,
  stampsRequired,
  posterHrefs,
}: {
  readonly initialTemplate: QrPosterTemplateId
  readonly qrDataUrl: string
  readonly venueName: string
  readonly stampsRequired: number
  readonly posterHrefs: Readonly<Record<QrPosterTemplateId, string>>
}) {
  const initialIndex = Math.max(
    0,
    QR_POSTER_TEMPLATES.findIndex((item) => item.id === initialTemplate)
  )
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLElement | null>>([])
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function centreSlide(index: number, behavior: ScrollBehavior) {
    const track = trackRef.current
    const slide = slideRefs.current[index]
    if (!track || !slide) return

    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
      behavior,
    })
  }

  useEffect(() => {
    centreSlide(initialIndex, "auto")
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [initialIndex])

  function settleOnClosestSlide() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      const track = trackRef.current
      if (!track) return

      const trackCentre =
        track.getBoundingClientRect().left + track.clientWidth / 2
      const closestIndex = slideRefs.current.reduce(
        (bestIndex, slide, index) => {
          if (!slide) return bestIndex
          const bounds = slide.getBoundingClientRect()
          const distance = Math.abs(
            bounds.left + bounds.width / 2 - trackCentre
          )
          const best = slideRefs.current[bestIndex]?.getBoundingClientRect()
          const bestDistance = best
            ? Math.abs(best.left + best.width / 2 - trackCentre)
            : Number.POSITIVE_INFINITY
          return distance < bestDistance ? index : bestIndex
        },
        0
      )
      setActiveIndex(closestIndex)
    }, 90)
  }

  function goTo(index: number) {
    const boundedIndex = Math.max(
      0,
      Math.min(QR_POSTER_TEMPLATES.length - 1, index)
    )
    setActiveIndex(boundedIndex)
    centreSlide(boundedIndex, "auto")
  }

  return (
    <section
      className="grid min-w-0 gap-4 lg:col-span-2"
      aria-label="Poster style carousel"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          <Eyebrow>Swipe the poster deck</Eyebrow>
          <h3 className="text-lg font-extrabold">Choose by feel</h3>
          <p className="text-sm text-muted-foreground">
            Swipe through the real posters. The centred card is your choice.
          </p>
        </div>
        <p className="mono-id shrink-0 text-muted-foreground">
          {activeIndex + 1} / {QR_POSTER_TEMPLATES.length}
        </p>
      </div>

      <div
        ref={trackRef}
        data-testid="poster-swipe-track"
        onScroll={settleOnClosestSlide}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto overscroll-x-contain px-[9%] py-2 [-ms-overflow-style:none] sm:px-[18%] lg:px-[calc((100%-28rem)/2)] [&::-webkit-scrollbar]:hidden"
      >
        {QR_POSTER_TEMPLATES.map((item, index) => (
          <article
            key={item.id}
            ref={(node) => {
              slideRefs.current[index] = node
            }}
            aria-current={activeIndex === index ? "true" : undefined}
            className={cn(
              "grid w-[82%] min-w-0 shrink-0 snap-center gap-3 rounded-lg border-2 border-ink bg-card p-3 transition-[transform,opacity,box-shadow] duration-300 motion-reduce:transition-none sm:w-[64%] lg:w-[28rem]",
              activeIndex === index
                ? "opacity-100 shadow-md"
                : "scale-[0.96] opacity-55 shadow-none"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold">{item.name}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {POSTER_USE_CASE[item.id]}
                </p>
              </div>
              <span className="mono-id text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="mx-auto w-full max-w-56 rounded-md border-2 border-ink bg-paper p-1.5">
              <PosterThumbnail
                previewLabel={`${item.name} poster preview`}
                template={item.id}
                qrDataUrl={qrDataUrl}
                merchantName={venueName}
                stampsRequired={stampsRequired}
              />
            </div>
            <Button asChild variant="reward" className="w-full">
              <Link
                href={posterHrefs[item.id]}
                target="_blank"
                rel="noreferrer"
              >
                Open {item.name.toLowerCase()} poster
                <Icon icon={ArrowUpRight01Icon} size={15} />
              </Link>
            </Button>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous poster"
          disabled={activeIndex === 0}
          onClick={() => goTo(activeIndex - 1)}
        >
          <Icon icon={ArrowLeft01Icon} size={18} />
        </Button>
        <div
          className="flex flex-1 justify-center gap-1.5"
          aria-label="Poster position"
        >
          {QR_POSTER_TEMPLATES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show ${item.name} poster`}
              aria-current={activeIndex === index ? "true" : undefined}
              onClick={() => goTo(index)}
              className={cn(
                "focus-ring h-2 rounded-sm border border-ink transition-[width,background-color] motion-reduce:transition-none",
                activeIndex === index ? "w-8 bg-primary" : "w-4 bg-paper-deep"
              )}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next poster"
          disabled={activeIndex === QR_POSTER_TEMPLATES.length - 1}
          onClick={() => goTo(activeIndex + 1)}
        >
          <Icon icon={ArrowRight01Icon} size={18} />
        </Button>
      </div>
    </section>
  )
}
