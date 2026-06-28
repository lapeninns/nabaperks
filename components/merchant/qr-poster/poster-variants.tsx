import styles from "./a4-poster.module.css"
import { FALLBACK_URL, type PosterCopy } from "./poster-copy"
import {
  BrandLockup,
  EditorialSteps,
  PosterFooter,
  QrBlock,
  StampProgress,
  TearLine,
  TicketSteps,
  Ticker,
  WatermarkFrame,
} from "./poster-pieces"

type PosterVariantProps = {
  readonly copy: PosterCopy
  readonly qrDataUrl: string
}

export function EditorialPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.card}>
      <Ticker />
      <WatermarkFrame />
      <div className={styles.editorialInner}>
        <header className={styles.editorialHeader}>
          <BrandLockup />
          <span className={styles.liveTag}>Live at this counter</span>
        </header>

        <section className={styles.editorialHero}>
          <p className={styles.kicker}>Free · No app · 20 seconds</p>
          <h1 className={styles.headline}>
            Everyone wins
            <br />
            <span>something.</span>
          </h1>
          <p className={styles.editorialLead}>
            {copy.unlockLine} — and <strong>every card wins</strong>.{" "}
            {copy.mysteryLine}
          </p>
        </section>

        <section className={styles.editorialMid}>
          <div className={styles.editorialCopyColumn}>
            <div className={styles.firstStampPanel}>
              <span>✱</span>
              <p>
                {copy.firstStampLine} —
                <br />
                just scan to claim it.
              </p>
            </div>
            <StampProgress copy={copy} />
            <EditorialSteps copy={copy} />
          </div>
          <QrBlock
            qrDataUrl={qrDataUrl}
            title={
              <>
                Scan to claim
                <br />
                your free stamp
              </>
            }
            holderClassName={styles.editorialQrHolder}
            burstClassName={styles.editorialBurst}
            footer={
              <>
                <p className={styles.cameraCopy}>
                  Open your camera, point it here
                </p>
                <p className={styles.fallbackCopy}>
                  No camera? <strong>{FALLBACK_URL}</strong>
                </p>
              </>
            }
          />
        </section>
      </div>
      <PosterFooter long />
    </div>
  )
}

export function BoldPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <>
      <WatermarkFrame />
      <div className={styles.boldInner}>
        <section className={styles.boldHeader}>
          <div className={styles.boldBrand}>
            <span>✱</span>
            <p>nabaperks · live at this counter</p>
          </div>
          <p className={styles.boldKicker}>Free · No app · 20 seconds</p>
          <h1 className={styles.boldHeadline}>
            Everyone wins
            <br />
            <span>something.</span>
          </h1>
          <p className={styles.boldLead}>
            {copy.compactLine.split(" — ")[0]} — and{" "}
            <strong>every card wins</strong>. Could be small. Could be a proper
            treat.
          </p>
        </section>

        <QrBlock
          qrDataUrl={qrDataUrl}
          holderClassName={styles.boldQrHolder}
          burstClassName={styles.boldBurst}
          footer={
            <p className={styles.boldQrCaption}>
              Point your camera · first stamp on us
            </p>
          }
        />

        <footer className={styles.boldFooter}>
          <p>Scan · Stamp · Reveal — everyone wins something</p>
          <div>
            <span>{FALLBACK_URL}</span>
            <span>·</span>
            <span>One stamp per business day</span>
            <span>·</span>
            <span>Powered by nabaperks</span>
          </div>
        </footer>
      </div>
    </>
  )
}

export function TicketPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.card}>
      <section className={styles.ticketTop}>
        <div aria-hidden="true" className={styles.ticketGhost}>
          ✱
        </div>
        <div className={styles.ticketTopContent}>
          <header className={styles.ticketHeader}>
            <BrandLockup inverted />
            <span className={styles.ticketAdmit}>Admit one · per day</span>
          </header>
          <p className={styles.ticketKicker}>Free · No app · 20 seconds</p>
          <h1 className={styles.ticketHeadline}>
            Everyone wins
            <br />
            <span>something.</span>
          </h1>
          <p className={styles.ticketLead}>
            Three stamps unlocks a reward — and every card wins. Your first
            stamp is on us.
          </p>
        </div>
      </section>

      <TearLine />

      <section className={styles.ticketBody}>
        <QrBlock
          qrDataUrl={qrDataUrl}
          title="Scan to claim your free stamp"
          holderClassName={styles.ticketQrHolder}
          burstClassName={styles.ticketBurst}
          footer={
            <p className={styles.ticketQrCaption}>
              No app required · point your camera here
            </p>
          }
        />
        <TicketSteps copy={copy} />
      </section>

      <PosterFooter />
    </div>
  )
}
