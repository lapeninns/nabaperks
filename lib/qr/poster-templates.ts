import {
  posterCollections,
  posterDesignIds,
  templateMetadata,
} from "@/lib/qr/poster-designs"
import type {
  PosterCollection,
  PosterDesignId,
  PosterTemplateMetadata,
} from "@/lib/qr/poster-designs"

export const QR_POSTER_TEMPLATE_IDS = posterDesignIds()

export type QrPosterTemplateId = PosterDesignId

const POSTER_TEMPLATE_ID_SET = new Set<string>(QR_POSTER_TEMPLATE_IDS)

export function isQrPosterTemplateId(
  templateId: string
): templateId is QrPosterTemplateId {
  return POSTER_TEMPLATE_ID_SET.has(templateId)
}

export type QrPosterTemplate = PosterTemplateMetadata

export const QR_POSTER_TEMPLATES: readonly QrPosterTemplate[] =
  QR_POSTER_TEMPLATE_IDS.map((id) => templateMetadata(id))

/**
 * Templates exposed to merchants — the pickers and the poster email bundle.
 * Review and experimental templates stay registered and render on direct
 * request, but never join this rotation.
 */
export const QR_POSTER_PRODUCTION_TEMPLATES: readonly QrPosterTemplate[] =
  QR_POSTER_TEMPLATES.filter(({ rollout }) => rollout === "production")

export type QrPosterCollection = PosterCollection & {
  readonly templates: readonly QrPosterTemplate[]
}

export const QR_POSTER_COLLECTIONS: readonly QrPosterCollection[] =
  posterCollections().map((collection) => ({
    ...collection,
    templates: QR_POSTER_TEMPLATES.filter(
      ({ collection: collectionId }) => collectionId === collection.id
    ),
  }))

export function getQrPosterTemplate(
  templateId: string
): QrPosterTemplate | null {
  if (!isQrPosterTemplateId(templateId)) return null
  return templateMetadata(templateId)
}

export function getQrPosterUseCase(templateId: QrPosterTemplateId): string {
  return templateMetadata(templateId).useCase
}

export function getQrPosterCollection(
  templateId: QrPosterTemplateId
): QrPosterCollection {
  const collectionId = templateMetadata(templateId).collection
  const collection = QR_POSTER_COLLECTIONS.find(({ id }) => id === collectionId)
  if (!collection) throw new Error(`Missing poster collection ${collectionId}`)
  return collection
}
