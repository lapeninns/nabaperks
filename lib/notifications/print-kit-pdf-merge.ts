import { PDFDocument } from "pdf-lib"

import {
  applyPrintPdfMetadata,
  type PrintPdfMetadata,
} from "./pdf-metadata"

/**
 * Concatenate one-or-more base64 PDF payloads into a single multi-page PDF.
 * Used to assemble duplex poster export files from single-page preview renders.
 */
export async function mergePdfBase64Documents(
  documents: readonly string[],
  metadata?: PrintPdfMetadata
): Promise<string> {
  if (documents.length === 0) {
    throw new Error("mergePdfBase64Documents requires at least one PDF")
  }
  if (documents.length === 1 && !metadata) {
    return documents[0]!
  }

  const output = await PDFDocument.create()
  for (const document of documents) {
    const source = await PDFDocument.load(Buffer.from(document, "base64"), {
      ignoreEncryption: true,
    })
    const pages = await output.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      output.addPage(page)
    }
  }
  if (metadata) {
    applyPrintPdfMetadata(output, metadata)
  }
  return Buffer.from(await output.save()).toString("base64")
}
