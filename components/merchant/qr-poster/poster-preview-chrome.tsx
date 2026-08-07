"use client"

import { useEffect, useRef, useState, type Ref } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { PrintKindNav } from "@/components/merchant/qr-poster/print-preview-nav"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"
import {
  PosterGuidanceText,
  PosterTemplateLinks,
  PrintButton,
  printSizeMeta,
} from "./poster-preview-controls"

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
          <p className="mono-id truncate tracking-[0.08em] text-muted-foreground">
            {merchantName}
          </p>
        </div>

        <PrintButton
          className="hidden shrink-0 lg:inline-flex"
          template={template}
        />

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
        <>
          {/* The four print assets are one journey; the kind row is the same
              control the tent, NFC card and wall plate previews now carry. */}
          <div className="mx-auto w-full max-w-[var(--poster-frame-max)] px-4 pb-2.5 sm:px-6 lg:max-w-none">
            <PrintKindNav
              kind="poster"
              qrCodeId={qrCodeId}
              backHref={backHref}
            />
          </div>
          <PosterTemplateLinks
            template={template}
            qrCodeId={qrCodeId}
            backHref={backHref}
            layout="strip"
            activePillRef={activePillRef}
            navRef={navRef}
          />
        </>
      ) : null}

      {guidanceOpen ? (
        <div
          id="poster-guidance-mobile"
          className="mx-auto w-full max-w-[var(--poster-frame-max)] px-4 pb-3 sm:px-6 lg:hidden"
        >
          <PosterGuidanceText />
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

  return (
    <aside className="qr-poster-sidecar hidden min-h-0 min-w-0 flex-col gap-4 border-l-2 border-ink bg-paper/95 p-4 lg:flex lg:overflow-y-auto">
      <div className="grid gap-2">
        <p className="mono-id tracking-[0.12em] text-muted-foreground">
          Poster collection
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
        <PosterGuidanceText />
        <p className="mono-id tracking-[0.1em] text-muted-foreground">
          {printSizeMeta()}
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
  return (
    <footer
      ref={ref}
      className="qr-poster-action-bar border-t-2 border-ink bg-paper/95 backdrop-blur-sm lg:hidden"
    >
      <div className="mx-auto grid w-full max-w-[var(--poster-frame-max)] gap-2 px-4 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:px-6 sm:py-3">
        <p className="mono-id tracking-[0.1em] text-muted-foreground">
          {printSizeMeta()}
        </p>
        <PrintButton className="w-full sm:w-fit" template={template} />
      </div>
    </footer>
  )
}
