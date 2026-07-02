"use client"

import "./globals.css"

/**
 * Global error boundary — the last resort when the root layout itself fails.
 * It must render its own <html>/<body>, so it stays deliberately minimal
 * (no brand component imports — each one is another failure surface) while
 * still speaking Wet Ink through the token classes from globals.css.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en-GB">
      <body className="font-sans">
        <main className="grid min-h-svh place-items-center bg-background px-6 py-10 text-foreground">
          <section className="w-full max-w-sm rounded-lg border-2 border-ink bg-card p-6 text-center shadow-xs">
            <h1 className="text-xl font-extrabold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nabaperks hit a snag loading this page. Nothing you saved has
              been lost.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="focus-ring mt-5 inline-flex h-11 w-full items-center justify-center rounded-md border-2 border-ink bg-primary px-4 font-bold text-primary-foreground"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
