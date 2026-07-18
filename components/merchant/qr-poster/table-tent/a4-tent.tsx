"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft02Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getTentDesign, type TableTentDesignId } from "@/lib/qr/tent-templates"

import styles from "./a4-tent.module.css"
import { TentSheet } from "./tent-sheet"

type A4TentProps = {
  readonly design: TableTentDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
  readonly backHref?: string
}

export function A4Tent({
  design,
  qrDataUrl,
  merchantName,
  stampsRequired,
  backHref,
}: A4TentProps) {
  const meta = getTentDesign(design)
  const pageRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // Scale the sheet against the real stage width so it never overflows the
  // merchant shell column; falls back to 100vw before this runs.
  useEffect(() => {
    const page = pageRef.current
    const stage = stageRef.current
    if (!page || !stage) return
    const apply = () => {
      page.style.setProperty(
        "--tent-avail-width",
        `${Math.round(stage.clientWidth)}px`
      )
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <main
      ref={pageRef}
      className={`${styles.page} qr-poster-print-root`}
      data-sheet="a4-tent"
    >
      <header className={`${styles.chrome} qr-poster-chrome`}>
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
              <Link href={backHref}>
                <Icon icon={ArrowLeft02Icon} size={16} />
                Back
              </Link>
            </Button>
          ) : null}
          <div className={styles.chromeMeta}>
            <h1 className={styles.chromeTitle}>{meta?.name ?? design}</h1>
            <span className={styles.chromeVenue}>{merchantName}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="reward"
          className="min-h-11 sm:min-h-9"
          onClick={() => window.print()}
        >
          <Icon icon={PrinterIcon} size={16} />
          Print or save PDF
        </Button>
      </header>
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.sheetScaler}>
          <div className={styles.sheetInner}>
            <TentSheet
              design={design}
              qrDataUrl={qrDataUrl}
              merchantName={merchantName}
              stampsRequired={stampsRequired}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
