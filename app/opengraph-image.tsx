import { ImageResponse } from "next/og"

/**
 * Static Wet Ink social-preview image (build-time, statically optimised). Applies
 * at the app root, so it is the default og:image / twitter:image for the homepage
 * and every marketing route that does not override it. Approved product copy
 * only — no performance stats. Uses Satori's default font (no remote fetch) and
 * conveys Wet Ink through paper/ink/vermillion, a hard frame and an offset
 * shadow.
 */
export const alt =
  "Nabaperks — loyalty cards for pubs, cafes and takeaways. QR scan. Browser-based card. Venue-linked stamps. 30-day pilot, then £49/month."

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const PAPER = "#f6f1e6"
const INK = "#211c16"
const VERMILLION = "#cf330a"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: 72,
          border: `14px solid ${INK}`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 68,
              height: 68,
              background: VERMILLION,
              color: "#ffffff",
              borderRadius: 9999,
              border: `4px solid ${INK}`,
              fontSize: 38,
              fontWeight: 800,
              transform: "rotate(-6deg)",
            }}
          >
            N
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Nabaperks
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              maxWidth: 960,
            }}
          >
            Loyalty cards for pubs, cafes and takeaways
          </div>
          {/* Satori needs literals — this is the ink-soft token (--w-ink-soft). */}
          <div style={{ fontSize: 33, maxWidth: 920, color: "#4f473d" }}>
            QR scan. Browser-based card. Venue-linked stamps.
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: INK,
              color: PAPER,
              fontSize: 30,
              fontWeight: 700,
              padding: "16px 28px",
              borderRadius: 10,
              boxShadow: `8px 8px 0 ${VERMILLION}`,
            }}
          >
            30-day pilot, then £49/month
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
