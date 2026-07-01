type JsonLdData = Record<string, unknown> | readonly Record<string, unknown>[]

type JsonLdProps = {
  readonly data: JsonLdData
  readonly id?: string
}

/**
 * Renders a server-side `<script type="application/ld+json">` block. JSON-LD is
 * static structured data we control, but we still escape `<` to `\u003c` so a
 * stray character in any field can't break out of the script element.
 */
export function JsonLd({ data, id }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c")
  return (
    <script
      id={id}
      suppressHydrationWarning
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
