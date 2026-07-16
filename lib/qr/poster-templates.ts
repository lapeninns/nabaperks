export const QR_POSTER_TEMPLATE_IDS = [
  "editorial",
  "bold",
  "ticket",
  "northstar",
  "thermal",
  "table-tent",
] as const

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
    description: "Calm counter card — “Three visits. One surprise.”",
  },
  {
    id: "bold",
    name: "Bold",
    description: "Dark hero poster — “Everyone wins something.”",
  },
  {
    id: "ticket",
    name: "Ticket",
    description: "Tear-off urgency — “First stamp's on us.”",
  },
  {
    id: "northstar",
    name: "Night card",
    description: "Dark receipt hero — the poster is your loyalty card.",
  },
  {
    id: "thermal",
    name: "Receipt",
    description: "Thermal till receipt — first stamp free, reward locked.",
  },
  {
    id: "table-tent",
    name: "Table tent",
    description:
      "B5 portrait — fold to peak; Visit · Stamp · Unlock.",
  },
] as const

export function getQrPosterTemplate(
  templateId: string
): QrPosterTemplate | null {
  return (
    QR_POSTER_TEMPLATES.find((template) => template.id === templateId) ?? null
  )
}
