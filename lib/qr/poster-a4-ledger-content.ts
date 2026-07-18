import { rawTemplateCopy } from "./poster-design-reader"
import {
  copyChoice,
  copyString,
  sharedMemberTag,
  validateStampsRequired,
} from "./poster-content-readers"
import { a4ContentBase } from "./poster-model-readers"
import type {
  LedgerClause,
  ManifestRow,
  PrimerPosterContent,
  SealPosterContent,
} from "./poster-kit-content-types"

export function resolvePrimerContent(
  stampsRequired: number
): PrimerPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("primer")
  const path = "posterDesigns.templates.primer.copy"
  const clause = (
    number: string,
    titleKey: string,
    detailKey: string,
    sealed: boolean
  ): LedgerClause => ({
    number,
    title: copyString(copy, titleKey, stamps, path),
    detail: copyString(copy, detailKey, stamps, path),
    sealed,
  })
  return {
    ...a4ContentBase("primer"),
    id: "primer",
    ledgerLabel: copyString(copy, "ledgerLabel", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: copyString(copy, "headline", stamps, path),
    clauses: [
      clause("01", "clauseOneTitle", "clauseOneDetail", false),
      clause("02", "clauseTwoTitle", "clauseTwoDetail", false),
      clause("03", "clauseThreeTitle", "clauseThreeDetail", false),
      clause("04", "clauseFourTitle", "clauseFourDetail", true),
    ],
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    issuerLabel: copyString(copy, "issuerLabel", stamps, path),
    memberTag: sharedMemberTag(),
    signature: copyString(copy, "signature", stamps, path),
  }
}

export function resolveSealContent(stampsRequired: number): SealPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("seal")
  const path = "posterDesigns.templates.seal.copy"
  const row = (
    labelKey: string,
    value: string,
    redacted: boolean,
    accent: boolean
  ): ManifestRow => ({
    label: copyString(copy, labelKey, stamps, path),
    value,
    redacted,
    accent,
  })
  return {
    ...a4ContentBase("seal"),
    id: "seal",
    manifestLabel: copyString(copy, "manifestLabel", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: copyString(copy, "headline", stamps, path),
    sealedTag: copyString(copy, "sealedTag", stamps, path),
    rows: [
      row("rewardLabel", "", true, false),
      row("opensLabel", copyChoice(copy, "opens", stamps, path), false, false),
      row(
        "keptLabel",
        copyString(copy, "keptValue", stamps, path),
        false,
        false
      ),
      row(
        "startsLabel",
        copyString(copy, "startsValue", stamps, path),
        false,
        true
      ),
    ],
    frictionLine: copyString(copy, "frictionLine", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    issuerLabel: copyString(copy, "issuerLabel", stamps, path),
    memberTag: sharedMemberTag(),
    signature: copyString(copy, "signature", stamps, path),
  }
}
