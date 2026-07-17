import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument } from "pdf-lib"
import type { PDFPage } from "pdf-lib"

import type { PdfFonts } from "./poster-pdf-types"

export async function createPosterDocument(
  title: string,
  subject: string
): Promise<{ readonly document: PDFDocument; readonly fonts: PdfFonts }> {
  const document = await PDFDocument.create()
  document.setTitle(title)
  document.setAuthor("Nabaperks")
  document.setSubject(subject)
  document.registerFontkit(fontkit)
  const fontDirectory = path.join(process.cwd(), "assets", "fonts")
  const [regularBytes, boldBytes, monoBytes, monoBoldBytes] = await Promise.all(
    [
      readFile(path.join(fontDirectory, "BricolageGrotesque-Regular.ttf")),
      readFile(path.join(fontDirectory, "BricolageGrotesque-Bold.ttf")),
      readFile(path.join(fontDirectory, "SpaceMono-Regular.ttf")),
      readFile(path.join(fontDirectory, "SpaceMono-Bold.ttf")),
    ]
  )
  const [regular, bold, mono, monoBold] = await Promise.all([
    document.embedFont(regularBytes, {
      subset: true,
      customName: "NABRGL+BricolageGrotesque-Regular",
    }),
    document.embedFont(boldBytes, {
      subset: true,
      customName: "NABBOL+BricolageGrotesque-Bold",
    }),
    document.embedFont(monoBytes, {
      subset: true,
      customName: "NABSMR+SpaceMono-Regular",
    }),
    document.embedFont(monoBoldBytes, {
      subset: true,
      customName: "NABSMB+SpaceMono-Bold",
    }),
  ])
  return { document, fonts: { regular, bold, mono, monoBold } }
}

export async function savePosterDocument(
  document: PDFDocument
): Promise<string> {
  return Buffer.from(await document.save()).toString("base64")
}

export function retainPosterFontPrograms(page: PDFPage, fonts: PdfFonts): void {
  for (const font of [fonts.regular, fonts.bold, fonts.mono, fonts.monoBold]) {
    page.drawText(" ", { x: 0, y: 0, size: 1, font, opacity: 0 })
  }
}
