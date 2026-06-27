type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

/**
 * Renders a server-side `<script type="application/ld+json">` block. JSON-LD is
 * static structured data we control, but we still escape `<` to `<` so a
 * stray character in any field can't break out of the script element.
 */
export function JsonLd({ data, id }: { data: JsonLdData; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
