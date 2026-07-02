"use client"

import { type ReactNode, useEffect, useRef } from "react"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"
import { getQrPosterTemplate } from "@/lib/qr/poster-templates"

import styles from "./a4-poster.module.css"
import { NorthStarPoster } from "./northstar/northstar-poster"
import { type CopyPosterTemplateId, getPosterCopy } from "./poster-copy"
import {
  PosterActionBar,
  PosterDesktopSidecar,
  PosterPreviewChrome,
} from "./poster-preview-chrome"
import { BoldPoster, EditorialPoster, TicketPoster } from "./poster-variants"
import { ThermalPoster } from "./thermal/thermal-poster"

type A4PosterProps = {
  readonly template: QrPosterTemplateId
  readonly qrDataUrl: string
  readonly shareUrl: string
  readonly merchantName: string
  readonly locationName: string
  readonly stampsRequired: number
  readonly qrCodeId?: string
  readonly backHref?: string
  readonly showSidebarTrigger?: boolean
}

const TEMPLATE_CLASS_NAMES: Record<CopyPosterTemplateId, string> = {
  editorial: styles.editorial,
  // `dark` (the global token scope) is bound to the bold sheet only — never the
  // page or toolbar — so the night-receipt accent/ink/shadow flip correctly and
  // stay themeable.
  bold: `${styles.bold} dark`,
  ticket: styles.ticket,
}

export function A4Poster({
  template,
  qrDataUrl,
  merchantName,
  locationName,
  stampsRequired,
  qrCodeId,
  backHref,
  showSidebarTrigger = true,
}: A4PosterProps) {
  const templateMeta = getQrPosterTemplate(template)
  const pageRef = useRef<HTMLElement>(null)
  const chromeRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const actionBarRef = useRef<HTMLElement>(null)

  // Drive the sheet scale off the chrome's *measured* height so the A4 canvas
  // never over-scales: the sticky PosterPreviewChrome grows when its guidance
  // panel opens or its template strip wraps at narrow widths, and the bottom
  // PosterActionBar grows when its meta + CTA stack on mobile. Writing both real
  // heights onto the .page root keeps --poster-screen-scale self-correcting
  // across breakpoints, reflows, and the guidance disclosure.
  useEffect(() => {
    const page = pageRef.current
    const chrome = chromeRef.current
    const stage = stageRef.current
    const actionBar = actionBarRef.current
    if (!page || !chrome) return

    const desktopQuery = window.matchMedia("(min-width: 1024px)")

    const apply = () => {
      page.style.setProperty(
        "--poster-chrome-offset",
        `${Math.round(chrome.getBoundingClientRect().height)}px`
      )
      page.style.setProperty(
        "--poster-action-bar-height",
        actionBar && !desktopQuery.matches
          ? `${Math.round(actionBar.getBoundingClientRect().height)}px`
          : "0px"
      )
      // Scale against the stage column on desktop (poster + sidecar), otherwise
      // the full page width inside the merchant shell.
      const widthSource =
        desktopQuery.matches && stage ? stage : page
      page.style.setProperty(
        "--poster-avail-width",
        `${Math.round(widthSource.clientWidth)}px`
      )
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(chrome)
    observer.observe(page)
    if (stage) observer.observe(stage)
    if (actionBar) observer.observe(actionBar)
    desktopQuery.addEventListener("change", apply)
    return () => {
      observer.disconnect()
      desktopQuery.removeEventListener("change", apply)
    }
  }, [])

  return (
    <main ref={pageRef} className={`${styles.page} qr-poster-print-root`}>
      <PosterPreviewChrome
        ref={chromeRef}
        template={template}
        templateName={templateMeta?.name ?? template}
        merchantName={merchantName}
        locationName={locationName}
        qrCodeId={qrCodeId}
        backHref={backHref}
        showSidebarTrigger={showSidebarTrigger}
      />
      <div className={styles.workspace}>
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.sheetScaler}>
            <div className={styles.sheetInner}>
              <PosterSheet
                template={template}
                qrDataUrl={qrDataUrl}
                merchantName={merchantName}
                locationName={locationName}
                stampsRequired={stampsRequired}
              />
            </div>
          </div>
        </div>
        <PosterDesktopSidecar template={template} qrCodeId={qrCodeId} backHref={backHref} />
      </div>
      <PosterActionBar ref={actionBarRef} />
    </main>
  )
}

/**
 * Concept posters (e.g. "northstar") are self-contained — they render their own
 * A4 `.sheet` and print handling — so they branch out before the shared sheet
 * shell. The copy-driven templates resolve through getPosterCopy and share one
 * `.sheet` article. Each new concept poster must be handled here before the copy
 * path, which keeps the template narrowing exhaustive at compile time.
 */
function PosterSheet({
  template,
  qrDataUrl,
  merchantName,
  locationName,
  stampsRequired,
}: Omit<A4PosterProps, "shareUrl">) {
  if (template === "northstar") {
    return (
      <NorthStarPoster
        qrDataUrl={qrDataUrl}
        businessName={merchantName}
        locationName={locationName}
        stampsRequired={stampsRequired}
      />
    )
  }

  if (template === "thermal") {
    return (
      <ThermalPoster
        qrDataUrl={qrDataUrl}
        businessName={merchantName}
        locationName={locationName}
        stampsRequired={stampsRequired}
      />
    )
  }

  const copy = getPosterCopy(
    { businessName: merchantName, locationName, stampsRequired },
    template
  )
  const posterByTemplate: Record<CopyPosterTemplateId, ReactNode> = {
    editorial: <EditorialPoster copy={copy} qrDataUrl={qrDataUrl} />,
    bold: <BoldPoster copy={copy} qrDataUrl={qrDataUrl} />,
    ticket: <TicketPoster copy={copy} qrDataUrl={qrDataUrl} />,
  }

  return (
    <article className={`${styles.sheet} ${TEMPLATE_CLASS_NAMES[template]}`}>
      {posterByTemplate[template]}
    </article>
  )
}
