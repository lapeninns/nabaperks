import type { ReactNode } from "react"

import styles from "./a4-poster.module.css"
import { FALLBACK_URL, type PosterCopy } from "./poster-copy"

export function BrandLockup({
  inverted = false,
}: {
  readonly inverted?: boolean
}) {
  return (
    <div className={styles.brand}>
      <span className={inverted ? styles.brandMarkInverted : styles.brandMark}>
        ✱
      </span>
      <span>nabaperks</span>
    </div>
  )
}

export function Ticker() {
  return (
    <div className={styles.ticker}>
      <p>
        First stamp free&nbsp;&nbsp;✱&nbsp;&nbsp;No
        app&nbsp;&nbsp;✱&nbsp;&nbsp;Everyone
        wins&nbsp;&nbsp;✱&nbsp;&nbsp;Scanned at the
        counter&nbsp;&nbsp;✱&nbsp;&nbsp;First stamp
        free&nbsp;&nbsp;✱&nbsp;&nbsp;No app&nbsp;&nbsp;✱&nbsp;&nbsp;Everyone
        wins&nbsp;&nbsp;✱
      </p>
    </div>
  )
}

export function WatermarkFrame() {
  return (
    <div aria-hidden="true" className={styles.watermarkFrame}>
      <div className={styles.watermarkAccent}>✱</div>
      <div className={styles.watermarkSun}>✱</div>
    </div>
  )
}

export function StampProgress({ copy }: { readonly copy: PosterCopy }) {
  return (
    <div>
      <p className={styles.progressLabel}>{copy.progressLabel}</p>
      <div className={styles.progressDots}>
        <div className={styles.progressActive}>
          <span>✱</span>
          <b>FREE</b>
        </div>
        <i />
        <span className={styles.progressEmpty}>2</span>
        <i />
        <span className={styles.progressReveal}>?</span>
      </div>
    </div>
  )
}

export function EditorialSteps({ copy }: { readonly copy: PosterCopy }) {
  return (
    <ol className={styles.editorialSteps}>
      <li>
        <b>Scan &amp; keep your card</b>
        <span>20 seconds in your browser. First stamp's on us.</span>
      </li>
      <li>
        <b>{copy.secondStepTitle}</b>
        <span>{copy.secondStepBody}</span>
      </li>
      <li>
        <b>Break the seal</b>
        <span>
          {copy.revealBody} <strong>Everyone wins.</strong>
        </span>
      </li>
    </ol>
  )
}

export function TicketSteps({ copy }: { readonly copy: PosterCopy }) {
  return (
    <ol className={styles.ticketSteps}>
      <li>
        <span className={styles.scanStepIcon}>
          <i />
        </span>
        <b>Scan</b>
        <small>Keep your card</small>
      </li>
      <li>
        <span className={styles.stampStepIcon}>✱</span>
        <b>Stamp</b>
        <small>{copy.ticketVisitLabel}</small>
      </li>
      <li>
        <span className={styles.revealStepIcon}>?</span>
        <b>Reveal</b>
        <small>Everyone wins</small>
      </li>
    </ol>
  )
}

export function QrBlock({
  qrDataUrl,
  title,
  holderClassName,
  burstClassName,
  footer,
}: {
  readonly qrDataUrl: string
  readonly title?: ReactNode
  readonly holderClassName: string
  readonly burstClassName: string
  readonly footer?: ReactNode
}) {
  return (
    <figure className={styles.qrBlock}>
      {title ? <figcaption>{title}</figcaption> : null}
      <div className={styles.qrWrap}>
        <div className={`${styles.scanBurst} ${burstClassName}`}>
          <span>
            Scan
            <br />
            me
          </span>
        </div>
        <div className={holderClassName}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
          <img
            src={qrDataUrl}
            alt="Nabaperks QR code"
            width={900}
            height={900}
          />
        </div>
      </div>
      {footer}
    </figure>
  )
}

export function TearLine() {
  return (
    <div className={styles.tearLine}>
      <span />
      <span />
      <i />
    </div>
  )
}

export function PosterFooter({ long = false }: { readonly long?: boolean }) {
  return (
    <footer className={styles.posterFooter}>
      <span>{FALLBACK_URL}</span>
      <span>
        {long
          ? "One stamp per business day · Powered by nabaperks"
          : "Powered by nabaperks"}
      </span>
    </footer>
  )
}
