import { resolveTentContent } from "@/lib/qr/tent-content"
import type { TableTentDesignId } from "@/lib/qr/tent-templates"

import { TentFace } from "./tent-face"
import styles from "./tent-sheet.module.css"

type TentSheetProps = {
  readonly design: TableTentDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

/**
 * The print artefact: a single A4 sheet holding both tent faces. Face B sits
 * in the rotated top half, Face A in the bottom half, with the fold guide
 * between them. Both faces share the one venue QR.
 */
export function TentSheet({
  design,
  qrDataUrl,
  merchantName,
  stampsRequired,
}: TentSheetProps) {
  const content = resolveTentContent(design, stampsRequired)
  const venue = merchantName.trim()

  return (
    <article
      className={styles.sheet}
      data-design={design}
      style={{
        width: `${content.geometry.sheetWidthMm}mm`,
        height: `${content.geometry.sheetHeightMm}mm`,
        minHeight: `${content.geometry.sheetHeightMm}mm`,
        maxHeight: `${content.geometry.sheetHeightMm}mm`,
      }}
    >
      <div className={`${styles.faceSlot} ${styles.faceSlotTop}`}>
        <TentFace
          content={content}
          face={content.faceB}
          venue={venue}
          qrDataUrl={qrDataUrl}
        />
      </div>
      <div aria-hidden="true" className={styles.foldLine} />
      <div className={styles.faceSlot}>
        <TentFace
          content={content}
          face={content.faceA}
          venue={venue}
          qrDataUrl={qrDataUrl}
        />
      </div>
    </article>
  )
}
