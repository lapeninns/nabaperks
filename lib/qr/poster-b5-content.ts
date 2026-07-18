import { rawFaceCopy } from "./poster-design-reader"
import {
  copyString,
  receiptItems,
  stringTuple2,
  stringTuple3,
  validateStampsRequired,
} from "./poster-content-readers"
import { b5ContentBase, b5FaceQr } from "./poster-model-readers"
import type {
  BaseTentContent,
  NightTentContent,
  StudioTentContent,
} from "./poster-content-types"

export function resolveBaseTentContent(
  stampsRequired: number
): BaseTentContent {
  const stamps = validateStampsRequired(stampsRequired)
  const bottom = rawFaceCopy("table-tent", "bottom")
  const top = rawFaceCopy("table-tent", "top")
  const bottomPath = "posterDesigns.templates.table-tent.faces.bottom.copy"
  const topPath = "posterDesigns.templates.table-tent.faces.top.copy"
  return {
    ...b5ContentBase(),
    id: "table-tent",
    faces: {
      bottom: {
        qr: b5FaceQr("table-tent", "bottom"),
        editionLabel: copyString(bottom, "editionLabel", stamps, bottomPath),
        stack: stringTuple3(bottom, "stack", stamps, bottomPath),
        rewardLine: copyString(bottom, "rewardLine", stamps, bottomPath),
        scanLabel: copyString(bottom, "scanLabel", stamps, bottomPath),
        scanCta: stringTuple2(bottom, "scanCta", stamps, bottomPath),
        frictionLine: copyString(bottom, "frictionLine", stamps, bottomPath),
        footerLeft: copyString(bottom, "footerLeft", stamps, bottomPath),
        footerCentre: copyString(bottom, "footerCentre", stamps, bottomPath),
        footerRight: copyString(bottom, "footerRight", stamps, bottomPath),
      },
      top: {
        qr: b5FaceQr("table-tent", "top"),
        headline: copyString(top, "headline", stamps, topPath),
        support: copyString(top, "support", stamps, topPath),
        frictionLine: copyString(top, "frictionLine", stamps, topPath),
        qrCaption: copyString(top, "qrCaption", stamps, topPath),
        reassurance: copyString(top, "reassurance", stamps, topPath),
      },
    },
  }
}

export function resolveNightTentContent(
  stampsRequired: number
): NightTentContent {
  const stamps = validateStampsRequired(stampsRequired)
  const bottom = rawFaceCopy("table-tent-night", "bottom")
  const top = rawFaceCopy("table-tent-night", "top")
  const bottomPath =
    "posterDesigns.templates.table-tent-night.faces.bottom.copy"
  const topPath = "posterDesigns.templates.table-tent-night.faces.top.copy"
  return {
    ...b5ContentBase(),
    id: "table-tent-night",
    faces: {
      bottom: {
        qr: b5FaceQr("table-tent-night", "bottom"),
        chip: copyString(bottom, "chip", stamps, bottomPath),
        headline: copyString(bottom, "headline", stamps, bottomPath),
        headlineAccent: copyString(
          bottom,
          "headlineAccent",
          stamps,
          bottomPath
        ),
        ease: copyString(bottom, "ease", stamps, bottomPath),
        promise: copyString(
          bottom,
          stamps === 1 ? "promiseOne" : "promiseMany",
          stamps,
          bottomPath
        ),
        qrCaption: copyString(bottom, "qrCaption", stamps, bottomPath),
        reassurance: copyString(bottom, "reassurance", stamps, bottomPath),
      },
      top: {
        qr: b5FaceQr("table-tent-night", "top"),
        meta: copyString(top, "meta", stamps, topPath),
        headline: copyString(top, "headline", stamps, topPath),
        headlineAccent: copyString(top, "headlineAccent", stamps, topPath),
        items: receiptItems(top, stamps, topPath),
        totalLabel: copyString(top, "totalLabel", stamps, topPath),
        totalValue: copyString(top, "totalValue", stamps, topPath),
        friction: copyString(top, "friction", stamps, topPath),
        qrCaption: copyString(top, "qrCaption", stamps, topPath),
        reassurance: copyString(top, "reassurance", stamps, topPath),
      },
    },
  }
}

export function resolveStudioTentContent(
  stampsRequired: number
): StudioTentContent {
  const stamps = validateStampsRequired(stampsRequired)
  const bottom = rawFaceCopy("table-tent-studio", "bottom")
  const top = rawFaceCopy("table-tent-studio", "top")
  const bottomPath =
    "posterDesigns.templates.table-tent-studio.faces.bottom.copy"
  const topPath = "posterDesigns.templates.table-tent-studio.faces.top.copy"
  return {
    ...b5ContentBase(),
    id: "table-tent-studio",
    faces: {
      bottom: {
        qr: b5FaceQr("table-tent-studio", "bottom"),
        headline: copyString(bottom, "headline", stamps, bottomPath),
        support: copyString(bottom, "support", stamps, bottomPath),
        frictionLine: copyString(bottom, "frictionLine", stamps, bottomPath),
        qrCaption: copyString(bottom, "qrCaption", stamps, bottomPath),
        reassurance: copyString(bottom, "reassurance", stamps, bottomPath),
      },
      top: {
        qr: b5FaceQr("table-tent-studio", "top"),
        headline: copyString(top, "headline", stamps, topPath),
        support: copyString(top, "support", stamps, topPath),
        frictionLine: copyString(top, "frictionLine", stamps, topPath),
        qrCaption: copyString(top, "qrCaption", stamps, topPath),
        reassurance: copyString(top, "reassurance", stamps, topPath),
      },
    },
  }
}
