"use client"

import { Fragment, type Ref } from "react"
import Link from "next/link"
import { PrinterIcon } from "@hugeicons/core-free-icons"

import { recordPosterPrintAction } from "@/app/app/qr/poster/actions"
import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  QR_POSTER_COLLECTIONS,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

const TEMPLATE_TAB_ACCENT: Record<QrPosterTemplateId, string> = {
  primer:
    "data-[active=true]:border-l-ink-soft data-[active=true]:bg-paper-deep",
  window:
    "data-[active=true]:border-l-primary data-[active=true]:bg-paper-deep",
  pinned: "data-[active=true]:border-l-cobalt data-[active=true]:bg-paper-deep",
  seal: "data-[active=true]:border-l-sun data-[active=true]:bg-paper-deep",
  tally: "data-[active=true]:border-l-cobalt data-[active=true]:bg-paper-deep",
  lastcall:
    "data-[active=true]:border-l-sun data-[active=true]:bg-ink data-[active=true]:text-paper",
  receipt:
    "data-[active=true]:border-l-primary data-[active=true]:bg-paper-deep",
  chalk:
    "data-[active=true]:border-l-leaf data-[active=true]:bg-ink data-[active=true]:text-paper",
}

export function PrintButton({
  className,
  template,
}: {
  readonly className?: string
  readonly template: QrPosterTemplateId
}) {
  return (
    <Button
      type="button"
      variant="reward"
      className={cn("min-h-11 sm:min-h-9", className)}
      onClick={() => {
        void recordPosterPrintAction(template)
        window.print()
      }}
    >
      <Icon icon={PrinterIcon} size={16} />
      Print or save PDF
    </Button>
  )
}

export function PosterGuidanceText() {
  return (
    <p className="rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/50 px-3 py-2 text-sm leading-6 text-muted-foreground">
      Preview matches print. Use{" "}
      <strong className="font-extrabold text-foreground">A4 portrait</strong> at{" "}
      <strong className="font-extrabold text-foreground">100% scale</strong> —
      no fit-to-page. Safe margins are built in for framing.
    </p>
  )
}

export function printSizeMeta(): string {
  return "A4 portrait · 210×297 mm · print at 100%"
}

export function PosterTemplateLinks({
  template,
  qrCodeId,
  backHref,
  layout,
  activePillRef,
  navRef,
}: {
  readonly template: QrPosterTemplateId
  readonly qrCodeId: string
  readonly backHref?: string
  readonly layout: "strip" | "stack"
  readonly activePillRef?: Ref<HTMLAnchorElement>
  readonly navRef?: Ref<HTMLElement>
}) {
  const isStrip = layout === "strip"

  return (
    <nav
      ref={navRef}
      aria-label="Poster designs by format"
      className={cn(
        isStrip
          ? "mx-auto flex w-full min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-2.5 [-ms-overflow-style:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
          : "hidden min-w-0 flex-col gap-2 lg:flex"
      )}
    >
      {QR_POSTER_COLLECTIONS.map((collection) => (
        <Fragment key={collection.id}>
          <span
            aria-hidden="true"
            className={cn(
              "mono-id text-muted-foreground",
              isStrip
                ? "flex shrink-0 items-center px-1 tracking-tag"
                : "mt-2 first:mt-0"
            )}
          >
            {collection.name}
          </span>
          {/* Merchants pick from the production rotation; a review or
              experimental template opened by direct URL still shows its own
              active pill rather than falling back to another design. */}
          {collection.templates
            .filter(
              (item) => item.rollout === "production" || item.id === template
            )
            .map((item) => {
              const isActive = item.id === template
              const from = backHref
                ? `&from=${encodeURIComponent(backHref)}`
                : ""
              return (
                <Link
                  key={item.id}
                  ref={isActive ? activePillRef : undefined}
                  href={`/app/qr/poster/${item.id}?qr=${qrCodeId}${from}`}
                  title={item.description}
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-ring border-2 border-l-[3px] border-ink bg-card font-extrabold shadow-sm transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    isStrip
                      ? "flex min-h-11 shrink-0 items-center rounded-lg px-3.5 text-sm leading-none whitespace-nowrap"
                      : "flex min-h-10 w-full items-center rounded-lg px-3 py-2.5 text-sm leading-snug",
                    TEMPLATE_TAB_ACCENT[item.id],
                    isActive && "shadow-md"
                  )}
                >
                  <span className="block">{item.name}</span>
                  {!isStrip ? (
                    <span className="mt-0.5 block text-xs leading-snug font-medium text-muted-foreground normal-case">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              )
            })}
        </Fragment>
      ))}
    </nav>
  )
}
