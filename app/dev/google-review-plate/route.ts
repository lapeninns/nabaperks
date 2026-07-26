import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REVIEW_KIT_PATH = join(
  process.cwd(),
  "output",
  "design",
  "Google Review Kit - Native Google.html"
)

const PLATE_HARNESS_STYLES = `
<style id="google-review-plate-harness">
  .appbar,
  .preview-grid > figure:not(.plate-figure),
  .plate-figure .figure-head {
    display: none !important;
  }

  main {
    min-height: 100vh;
    max-width: none;
    padding: 24px;
    display: grid;
    place-items: center;
  }

  .preview-grid {
    display: block;
  }

  figure.plate-figure {
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .plate-die {
    margin: 0;
    transform: none;
  }

  @media (max-width: 520px) {
    .plate-die {
      margin-bottom: -72px;
      transform: scale(.82);
    }
  }
</style>
`

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 })
  }

  try {
    const kit = await readFile(REVIEW_KIT_PATH, "utf8")
    const interactiveKit = kit.replace(
      /<script>[\s\S]*?<\/script>/u,
      '<script src="/dev/google-review-plate/controls.js"></script>'
    )
    const showFullKit = new URL(request.url).searchParams.get("view") === "all"
    const document = showFullKit
      ? interactiveKit
      : interactiveKit.replace("</head>", `${PLATE_HARNESS_STYLES}</head>`)

    return new Response(document, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  } catch {
    return new Response("Google Review plate source is unavailable.", {
      status: 500,
    })
  }
}
