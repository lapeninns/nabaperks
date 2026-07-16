"use client"

import { useEffect, useRef, useState, type Ref } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  InformationCircleIcon,
  PrinterIcon,
} from "@hugeicons/core-free-icons"

import { recordPosterPrintAction } from "@/app/app/qr/poster/actions"
import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

type PosterChromeProps = {
  readonly template: QrPosterTemplateId
  readonly templateName: string
  readonly merchantName: string
  readonly qrCodeId?: string
  readonly backHref?: string
  readonly showSidebarTrigger?: boolean
}

type PosterPreviewChromeProps = PosterChromeProps & {
  /** Forwarded to the chrome's root so the sheet scaler can measure its height. */
  readonly ref?: Ref<HTMLElement>
}

/**
 * Per-template accent on the active pill. Light templates tint with deeper
 * paper; the two dark posters (bold, northstar) invert to ink so the active
 * state still reads on a white sheet preview.
 */
const TEMPLATE_TAB_ACCENT: Record<QrPosterTemplateId, string> = {
  editorial:
    "data-[active=true]:border-l-cobalt data-[active=true]:bg-paper-deep",
  bold: "data-[active=true]:border-l-ink data-[active=true]:bg-ink data-[active=true]:text-paper",
  ticket:
    "data-[active=true]:border-l-primary data-[active=true]:bg-paper-deep",
  northstar:
    "data-[active=true]:border-l-sun data-[active=true]:bg-ink data-[active=true]:text-paper",
  thermal:
    "data-[active=true]:border-l-ink-soft data-[active=true]:bg-paper-deep",
  "table-tent":
    "data-[active=true]:border-l-cobalt data-[active=true]:bg-paper-deep",
}

function PrintButton({
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
        // Fire-and-forget: printing must never wait on analytics.
        void recordPosterPrintAction(template)
        window.print()
      }}
    >
      <Icon icon={PrinterIcon} size={16} />
      Print or save PDF
    </Button>
  )
}

function PosterGuidanceText({
  tableTent = false,
}: {
  readonly tableTent?: boolean
}) {
  if (tableTent) {
    return (
      <p className="rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/50 px-3 py-2 text-sm leading-6 text-muted-foreground">
        Preview matches print. Use{" "}
        <strong className="font-extrabold text-foreground">B5 portrait</strong>{" "}
        at{" "}
        <strong className="font-extrabold text-foreground">100% scale</strong> —
        no fit-to-page. Fold the top half down at “Fold to peak” — Visit · Stamp ·
        Unlock on the left, vermillion scan on the right.
      </p>
    )
  }

  return (
    <p className="rounded-lg border-2 border-dashed border-ink/25 bg-paper-deep/50 px-3 py-2 text-sm leading-6 text-muted-foreground">
      Preview matches print. Use{" "}
      <strong className="font-extrabold text-foreground">A4 portrait</strong> at{" "}
      <strong className="font-extrabold text-foreground">100% scale</strong> — no
      fit-to-page. Safe margins are built in for framing.
    </p>
  )
}

function printSizeMeta(tableTent: boolean): string {
  return tableTent
    ? "B5 portrait · 176×250 mm · fold top down at peak · print at 100%"
    : "A4 portrait · 210×297 mm · print at 100%"
}

function PosterTemplateLinks({
  template,
  qrCodeId,
  backHref,
  layout,
  activePillRef,
  navRef,
}: {
  readonly template: QrPosterTemplateId
  readonly qrCodeId: string
  /** Resolved return base — threaded through `?from=` so switching template
   *  keeps the Back button pointing at the shell the merchant came from
   *  (previously dropped, falling back to /app/qr after one switch). */
  readonly backHref?: string
  readonly layout: "strip" | "stack"
  activePillRef?: Ref<HTMLAnchorElement>
  navRef?: Ref<HTMLElement>
}) {
  const isStrip = layout === "strip"

  return (
    <nav
      ref={navRef}
      aria-label="Poster templates"
      className={cn(
        isStrip
          ? "mx-auto flex w-full min-w-0 gap-2 overflow-x-auto px-4 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
          : "hidden min-w-0 flex-col gap-2 lg:flex"
      )}
    >
      {QR_POSTER_TEMPLATES.map((item) => {
        const isActive = item.id === template

        return (
          <Link
            key={item.id}
            ref={isActive ? activePillRef : undefined}
            href={`/app/qr/poster/${item.id}?qr=${qrCodeId}${backHref ? `&from=${encodeURIComponent(backHref)}` : ""}`}
            title={item.description}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-ring border-2 border-ink border-l-[3px] bg-card font-extrabold shadow-sm transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
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
    </nav>
  )
}

export function PosterPreviewChrome({
  template,
  templateName,
  merchantName,
  qrCodeId,
  backHref = "/app/qr",
  showSidebarTrigger = true,
  ref,
}: PosterPreviewChromeProps) {
  const [guidanceOpen, setGuidanceOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const activePillRef = useRef<HTMLAnchorElement>(null)
  const isTableTent = template === "table-tent"

  // Keep the active template pill in view as the strip scrolls (the active one
  // can be the 4th/5th pill, off-screen on phones). Scroll the nav element
  // itself — not scrollIntoView, which would also move the surrounding page.
  useEffect(() => {
    const nav = navRef.current
    const pill = activePillRef.current
    if (!nav || !pill) return
    const target = pill.offsetLeft - (nav.clientWidth - pill.clientWidth) / 2
    nav.scrollTo({ left: Math.max(0, target) })
  }, [template])

  return (
    <header
      ref={ref}
      className="qr-poster-chrome sticky top-0 z-20 border-b-2 border-ink bg-paper/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-[var(--poster-frame-max)] items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:max-w-none">
        {showSidebarTrigger ? (
          <SidebarTrigger
            className="size-11 shrink-0 md:hidden"
            aria-label="Open menu"
          />
        ) : null}

        <Button
          asChild
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0 sm:min-h-9"
        >
          <Link href={backHref}>
            <Icon icon={ArrowLeft01Icon} size={16} />
            Back
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-extrabold text-balance sm:text-lg">
            {templateName}
          </h1>
          <p className="truncate mono-id tracking-[0.08em] text-muted-foreground">
            {merchantName}
          </p>
        </div>

        <PrintButton className="hidden shrink-0 lg:inline-flex" template={template} />

        <button
          type="button"
          aria-expanded={guidanceOpen}
          aria-controls="poster-guidance-mobile"
          onClick={() => setGuidanceOpen((open) => !open)}
          className={cn(
            "pressable inline-grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-card text-ink shadow-sm transition-[transform,box-shadow,background-color] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none lg:hidden",
            guidanceOpen && "bg-paper-deep"
          )}
        >
          <Icon icon={InformationCircleIcon} size={18} />
          <span className="sr-only">Print guidance</span>
        </button>
      </div>

      {qrCodeId ? (
        <PosterTemplateLinks
          template={template}
          qrCodeId={qrCodeId}
          backHref={backHref}
          layout="strip"
          activePillRef={activePillRef}
          navRef={navRef}
        />
      ) : null}

      {guidanceOpen ? (
        <div
          id="poster-guidance-mobile"
          className="mx-auto w-full max-w-[var(--poster-frame-max)] px-4 pb-3 sm:px-6 lg:hidden"
        >
          <PosterGuidanceText tableTent={isTableTent} />
        </div>
      ) : null}
    </header>
  )
}

/**
 * Desktop side panel — templates, print guidance, and meta. Sits beside the
 * scaled A4 stage at lg+ so the narrow sheet preview can grow without the
 * chrome hugging a phone-width column.
 */
export function PosterDesktopSidecar({
  template,
  qrCodeId,
  backHref,
}: Pick<PosterChromeProps, "template" | "qrCodeId" | "backHref">) {
  if (!qrCodeId) return null

  const isTableTent = template === "table-tent"

  return (
    <aside className="qr-poster-sidecar hidden min-h-0 min-w-0 flex-col gap-4 border-l-2 border-ink bg-paper/95 p-4 lg:flex lg:overflow-y-auto">
      <div className="grid gap-2">
        <p className="mono-id tracking-[0.12em] text-muted-foreground">
          Templates
        </p>
        <PosterTemplateLinks
          template={template}
          qrCodeId={qrCodeId}
          backHref={backHref}
          layout="stack"
        />
      </div>

      <div className="grid gap-2">
        <p className="mono-id tracking-[0.12em] text-muted-foreground">
          Print setup
        </p>
        <PosterGuidanceText tableTent={isTableTent} />
        <p className="mono-id tracking-[0.1em] text-muted-foreground">
          {printSizeMeta(isTableTent)}
        </p>
      </div>
    </aside>
  )
}

type PosterActionBarProps = {
  /** Forwarded so A4Poster can measure the bar and reserve space in the scale. */
  readonly ref?: Ref<HTMLElement>
  readonly template: QrPosterTemplateId
}

/**
 * Sticky bottom action bar — the print CTA lives in the thumb zone on mobile.
 * At lg+ the header and sidecar own print actions, so this bar is hidden.
 */
export function PosterActionBar({ ref, template }: PosterActionBarProps) {
  const isTableTent = template === "table-tent"

  return (
    <footer
      ref={ref}
      className="qr-poster-action-bar border-t-2 border-ink bg-paper/95 backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto grid w-full max-w-[var(--poster-frame-max)] gap-2 px-4 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:px-6 sm:py-3">
        <p className="mono-id tracking-[0.1em] text-muted-foreground">
          {printSizeMeta(isTableTent)}
        </p>
        <PrintButton className="w-full sm:w-fit" template={template} />
      </div>
    </footer>
  )
}
