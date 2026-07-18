"use client"

import { useEffect, useRef } from "react"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"
import { getQrPosterTemplate } from "@/lib/qr/poster-templates"

import styles from "./a4-poster.module.css"
import {
  PosterActionBar,
  PosterDesktopSidecar,
  PosterPreviewChrome,
} from "./poster-preview-chrome"
import { PosterDesignSheet } from "./poster-renderer-registry"

type A4PosterProps = {
  readonly template: QrPosterTemplateId
  readonly qrDataUrl: string
  readonly shareUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
  readonly qrCodeId?: string
  readonly backHref?: string
  readonly showSidebarTrigger?: boolean
}

export function A4Poster({
  template,
  qrDataUrl,
  merchantName,
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
      const widthSource = desktopQuery.matches && stage ? stage : page
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
    <main
      ref={pageRef}
      className={`${styles.page} qr-poster-print-root`}
      data-sheet="a4"
    >
      <PosterPreviewChrome
        ref={chromeRef}
        template={template}
        templateName={templateMeta?.name ?? template}
        merchantName={merchantName}
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
                stampsRequired={stampsRequired}
              />
            </div>
          </div>
        </div>
        <PosterDesktopSidecar
          template={template}
          qrCodeId={qrCodeId}
          backHref={backHref}
        />
      </div>
      <PosterActionBar ref={actionBarRef} template={template} />
    </main>
  )
}

export type PosterSheetProps = Pick<
  A4PosterProps,
  "template" | "qrDataUrl" | "merchantName" | "stampsRequired"
>

export function PosterSheet({
  template,
  qrDataUrl,
  merchantName,
  stampsRequired,
}: PosterSheetProps) {
  return (
    <PosterDesignSheet
      template={template}
      qrDataUrl={qrDataUrl}
      merchantName={merchantName}
      stampsRequired={stampsRequired}
    />
  )
}
