import { PDFDocument, PDFName, PDFString } from "pdf-lib"

export type PrintPdfMetadata = {
  readonly title: string
  readonly subject: string
  readonly author?: string
  readonly language?: string
}

/** Apply consistent document metadata to native and browser-rendered print PDFs. */
export function applyPrintPdfMetadata(
  document: PDFDocument,
  metadata: PrintPdfMetadata
): void {
  document.setTitle(metadata.title)
  document.setAuthor(metadata.author ?? "Nabaperks")
  document.setSubject(metadata.subject)
  document.setCreator("Nabaperks")
  document.catalog.set(
    PDFName.of("Lang"),
    PDFString.of(metadata.language ?? "en-GB")
  )
}
