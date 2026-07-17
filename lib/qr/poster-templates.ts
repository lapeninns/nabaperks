import {
  posterDesignIds,
  posterTableTentIds,
  templateMetadata,
} from "@/lib/qr/poster-designs"
import type { PosterDesignId } from "@/lib/qr/poster-designs"
import type { PosterTableTentId } from "@/lib/qr/poster-content-types"

export const QR_POSTER_TEMPLATE_IDS = posterDesignIds()

export type QrPosterTemplateId = PosterDesignId

export const QR_POSTER_TABLE_TENT_IDS = posterTableTentIds()

export type QrPosterTableTentId = PosterTableTentId

export function isQrPosterTableTent(
  templateId: string
): templateId is QrPosterTableTentId {
  for (const id of QR_POSTER_TABLE_TENT_IDS) {
    if (id === templateId) return true
  }
  return false
}

export function isQrPosterTemplateId(
  templateId: string
): templateId is QrPosterTemplateId {
  for (const id of QR_POSTER_TEMPLATE_IDS) {
    if (id === templateId) return true
  }
  return false
}

export type QrPosterTemplate = {
  readonly id: QrPosterTemplateId
  readonly name: string
  readonly description: string
}

export const QR_POSTER_TEMPLATES: readonly QrPosterTemplate[] =
  QR_POSTER_TEMPLATE_IDS.map((id) => {
    const design = templateMetadata(id)
    return {
      id,
      name: design.name,
      description: design.description,
    }
  })

export function getQrPosterTemplate(
  templateId: string
): QrPosterTemplate | null {
  if (!isQrPosterTemplateId(templateId)) return null
  const design = templateMetadata(templateId)
  return {
    id: templateId,
    name: design.name,
    description: design.description,
  }
}

export function getQrPosterUseCase(templateId: QrPosterTemplateId): string {
  return templateMetadata(templateId).useCase
}
