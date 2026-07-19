import type { TentContent, TentFaceContent } from "@/lib/qr/tent-content"

import styles from "./tent-face.module.css"

type TentFaceProps = {
  readonly content: TentContent
  readonly face: TentFaceContent
  readonly venue: string
  readonly qrDataUrl: string
}

function venueInitials(venue: string): string {
  const initials = venue
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
  return initials.length > 0 ? initials : "★"
}

function Headline({ face }: { readonly face: TentFaceContent }) {
  return (
    <h2 className={styles.headline}>
      {face.headline.map((line, index) => (
        <span key={`${line}-${index}`} style={{ display: "block" }}>
          {line === face.accent ? (
            <span className={styles.headlineAccent}>{line}</span>
          ) : (
            line
          )}
        </span>
      ))}
    </h2>
  )
}

/** Endowed-progress strip: N visit stamps, then a separate sealed reward. */
function StampStrip({
  venue,
  stampsRequired,
}: {
  readonly venue: string
  readonly stampsRequired: number
}) {
  const initials = venueInitials(venue)
  return (
    <div aria-hidden="true" className={styles.stamps}>
      {Array.from({ length: stampsRequired }, (_, index) => {
        const kind = index === 0 ? "venue" : "empty"
        return (
          <span key={index} className={styles.stamp} data-kind={kind}>
            {index === 0 ? initials : String(index + 1)}
          </span>
        )
      })}
      <span className={styles.stamp} data-kind="seal">
        ?
      </span>
    </div>
  )
}

export function TentFace({ content, face, venue, qrDataUrl }: TentFaceProps) {
  return (
    <section
      className={styles.face}
      data-tone={face.tone}
      data-variant={face.variant}
    >
      <header className={styles.header}>
        <span className={styles.brand}>
          <span aria-hidden="true" className={styles.brandMark}>
            ✱
          </span>
          <span>
            Nab <span className={styles.brandAccent}>a</span> Perks
          </span>
        </span>
        <span className={styles.kicker}>
          <span>{content.kicker}</span>
          <b className={styles.edition}>{venue}</b>
        </span>
      </header>

      <div className={styles.main}>
        <div className={styles.copy}>
          {face.badge ? (
            <span className={styles.badge}>{face.badge}</span>
          ) : null}
          <Headline face={face} />
          <p className={styles.body}>{face.body}</p>
          {face.showStamps ? (
            <StampStrip venue={venue} stampsRequired={content.stampsRequired} />
          ) : null}
        </div>
        <div className={styles.action}>
          <div
            className={styles.qrBox}
            style={{
              width: `${content.qr.outerMm}mm`,
              height: `${content.qr.outerMm}mm`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
            <img
              src={qrDataUrl}
              alt="Nabaperks QR code"
              width={900}
              height={900}
            />
          </div>
          <span className={styles.cta}>{face.cta}</span>
        </div>
      </div>

      <footer className={styles.footer}>
        <span>{content.footer.left}</span>
        <span>{content.footer.right}</span>
      </footer>
    </section>
  )
}
