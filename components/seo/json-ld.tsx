import { headers } from "next/headers"

type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

/**
 * Renders a server-side `<script type="application/ld+json">` block. JSON-LD is
 * static structured data we control, but we still escape `<` to `\u003c` so a
 * stray character in any field can't break out of the script element.
 */
export async function JsonLd({
  data,
  id,
  nonce,
}: {
  data: JsonLdData
  id?: string
  nonce?: string
}) {
  const scriptNonce = nonce ?? (await headers()).get("x-nonce") ?? undefined
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  return (
    <script
      id={id}
      nonce={scriptNonce}
      suppressHydrationWarning
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
