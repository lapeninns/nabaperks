export const QR_POSTER_TEMPLATE_IDS = ["editorial", "bold", "ticket"] as const

export type QrPosterTemplateId = (typeof QR_POSTER_TEMPLATE_IDS)[number]

export type QrPosterTemplate = {
  readonly id: QrPosterTemplateId
  readonly name: string
  readonly description: string
}

export const QR_POSTER_TEMPLATES: readonly QrPosterTemplate[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "Two-column counter poster matching the reference frame.",
  },
  {
    id: "bold",
    name: "Bold",
    description: "Full-ink poster with the QR code as the hero.",
  },
  {
    id: "ticket",
    name: "Ticket",
    description: "Tear-off ticket poster with the QR and stamp steps.",
  },
] as const

export function getQrPosterTemplate(
  templateId: string
): QrPosterTemplate | null {
  return (
    QR_POSTER_TEMPLATES.find((template) => template.id === templateId) ?? null
  )
}
