import type { HTMLAttributes } from "react"
import { notFound } from "next/navigation"

import { renderQrCodePng } from "@/lib/qr/assets"

// THROWAWAY design-exploration harness for A5 table tents (not a spec surface).
// Reuses the real Wet Ink font CSS vars + a live QR so the concepts read true
// to the poster family. Dev-only. Rebalanced: each face centres its hook→QR→
// stamps block and pins the footer, so the tall A5 reads full, not slack.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAPER = "#f6f1e6"
const PAPER2 = "#ece5d4"
const INK = "#211c16"
const INK_SOFT = "#4f473d"
const NIGHT = "#1b1712"
const CREAM = "#f3ecdd"
const ACCENT = "#cf330a"
const DISPLAY = "var(--font-bricolage-grotesque), system-ui, sans-serif"
const MONO = "var(--font-space-mono), ui-monospace, monospace"

// A5 portrait face, in mm — the real print size of one tent panel.
const FACE = { width: "148mm", height: "210mm" }

function Mono(props: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      style={{
        fontFamily: MONO,
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        fontWeight: 700,
        ...props.style,
      }}
    />
  )
}

function StampRow({ dark = false }: { dark?: boolean }) {
  const line = dark ? "rgba(243,236,221,0.5)" : "rgba(33,28,22,0.5)"
  return (
    <div style={{ display: "flex", gap: "11px", alignItems: "center", justifyContent: "center" }}>
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: ACCENT,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 12.5,
          transform: "rotate(-7deg)",
          boxShadow: "2px 2px 0 rgba(0,0,0,0.28)",
        }}
      >
        OC
      </span>
      {[2, 3].map((n) => (
        <span
          key={n}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            border: `2px dashed ${line}`,
            color: line,
            display: "grid",
            placeItems: "center",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {n}
        </span>
      ))}
    </div>
  )
}

function Qr({ src, size = "46mm", caption, dark = false }: { src: string; size?: string; caption: string; dark?: boolean }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: "8px" }}>
      <Mono style={{ fontSize: 12, color: dark ? CREAM : INK }}>{caption}</Mono>
      <div
        style={{
          width: size,
          height: size,
          background: "#fff",
          border: `2px solid ${INK}`,
          borderRadius: 12,
          padding: "4mm",
          boxSizing: "border-box",
          boxShadow: dark ? "3px 3px 0 rgba(0,0,0,0.5)" : "4px 4px 0 rgba(33,28,22,0.9)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Join QR" width={900} height={900} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  )
}

function Footer({ dark = false }: { dark?: boolean }) {
  const c = dark ? CREAM : INK
  const soft = dark ? "rgba(243,236,221,0.6)" : INK_SOFT
  const rule = dark ? "rgba(243,236,221,0.28)" : "rgba(33,28,22,0.3)"
  return (
    <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `2px dashed ${rule}`, paddingTop: "8px" }}>
      <Mono style={{ fontSize: 10, color: c, display: "inline-flex", gap: 6, alignItems: "center", letterSpacing: "0.08em" }}>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: ACCENT, color: "#fff", display: "grid", placeItems: "center", fontSize: 9, transform: "rotate(-6deg)" }}>✱</span>
        Powered by nabaperks
      </Mono>
      <Mono style={{ fontSize: 10, color: soft, letterSpacing: "0.08em" }}>No app · Opens in your browser</Mono>
    </footer>
  )
}

/* ---------- Concept 1 — Editorial (calm counter card) ---------- */
function TentEditorial({ qr }: { qr: string }) {
  return (
    <article
      data-testid="tent-editorial"
      style={{ ...FACE, boxSizing: "border-box", background: PAPER, color: INK, border: `5px solid ${INK}`, boxShadow: "10px 10px 0 rgba(33,28,22,0.9)", display: "flex", flexDirection: "column", padding: "13mm 11mm 9mm", position: "relative" }}
    >
      <div style={{ position: "absolute", top: "8mm", left: "11mm", right: "11mm", height: 3, background: ACCENT }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "8mm" }}>
        <div style={{ display: "grid", gap: "3mm" }}>
          <Mono style={{ fontSize: 11, color: INK_SOFT }}>Old Crown Girton</Mono>
          <h2 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: 42, lineHeight: 0.94, letterSpacing: "-0.03em" }}>
            Three visits.
            <br />
            One <span style={{ color: ACCENT }}>surprise</span>.
          </h2>
          <p style={{ margin: "1mm auto 0", maxWidth: "24ch", fontSize: 14.5, fontWeight: 600, lineHeight: 1.32, color: INK }}>
            Your first stamp&apos;s already waiting — collect the rest to reveal it.
          </p>
        </div>
        <Qr src={qr} caption="Scan to join" />
        <StampRow />
      </div>
      <Footer />
    </article>
  )
}

/* ---------- Concept 2 — Night (bold / dark) ---------- */
function TentNight({ qr }: { qr: string }) {
  return (
    <article
      data-testid="tent-night"
      style={{ ...FACE, boxSizing: "border-box", background: NIGHT, color: CREAM, border: `5px solid ${INK}`, boxShadow: "10px 10px 0 rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", padding: "13mm 11mm 9mm", position: "relative" }}
    >
      <div style={{ position: "absolute", top: "8mm", left: "11mm", right: "11mm", height: 3, background: ACCENT }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "8mm" }}>
        <div style={{ display: "grid", gap: "3mm" }}>
          <Mono style={{ fontSize: 11, color: "rgba(243,236,221,0.7)" }}>Old Crown Girton</Mono>
          <h2 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: 0.9, letterSpacing: "-0.035em", color: CREAM }}>
            Everyone <span style={{ color: ACCENT }}>wins</span> something.
          </h2>
          <p style={{ margin: "1mm auto 0", maxWidth: "26ch", fontSize: 14, fontWeight: 600, lineHeight: 1.32, color: "rgba(243,236,221,0.82)" }}>
            First stamp&apos;s on us. The rest unlock a mystery reward.
          </p>
        </div>
        <Qr src={qr} size="48mm" caption="Scan to claim your free stamp" dark />
        <StampRow dark />
      </div>
      <Footer dark />
    </article>
  )
}

/* ---------- Concept 3 — Ticket (first-stamp-free strap) ---------- */
function TentTicket({ qr }: { qr: string }) {
  return (
    <article
      data-testid="tent-ticket"
      style={{ ...FACE, boxSizing: "border-box", background: PAPER, color: INK, border: `5px solid ${INK}`, boxShadow: "10px 10px 0 rgba(33,28,22,0.9)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
    >
      <div style={{ background: ACCENT, color: "#fff", textAlign: "center", padding: "8mm 8mm 7mm", position: "relative", flex: "none" }}>
        <Mono style={{ fontSize: 12.5, color: "#fff", letterSpacing: "0.2em" }}>First stamp free</Mono>
        <h2 style={{ margin: "3px 0 0", fontFamily: DISPLAY, fontWeight: 800, fontSize: 38, lineHeight: 0.95, letterSpacing: "-0.03em", color: "#fff" }}>
          Scan. Sip.{" "}
          <span style={{ background: "#fff", color: ACCENT, padding: "0 0.14em", borderRadius: 3 }}>Collect.</span>
        </h2>
        <div style={{ position: "absolute", bottom: -12, left: "8mm", right: "8mm", borderTop: `2px dashed ${INK}` }} />
        <span style={{ position: "absolute", bottom: -12, left: "5mm", width: 22, height: 22, borderRadius: "50%", background: PAPER, border: `2px solid ${INK}`, transform: "translateY(-50%)" }} />
        <span style={{ position: "absolute", bottom: -12, right: "5mm", width: 22, height: 22, borderRadius: "50%", background: PAPER, border: `2px solid ${INK}`, transform: "translateY(-50%)" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "7mm", padding: "0 11mm" }}>
        <p style={{ margin: 0, maxWidth: "24ch", fontSize: 15, fontWeight: 600, lineHeight: 1.32 }}>
          Three visits unlock a <span style={{ color: ACCENT, fontWeight: 800 }}>mystery reward</span>.
        </p>
        <Qr src={qr} caption="Scan to join" />
        <StampRow />
      </div>
      <div style={{ padding: "0 11mm 9mm" }}>
        <Footer />
      </div>
    </article>
  )
}

/* ---------- Standing-tent mock (shows the fold / format) ---------- */
function StandingTent({ qr }: { qr: string }) {
  const panel = {
    width: "104mm",
    height: "150mm",
    background: PAPER,
    color: INK,
    border: `4px solid ${INK}`,
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: "5mm",
    padding: "9mm 8mm",
  }
  const inner = (
    <>
      <h3 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: 25, lineHeight: 0.95, textAlign: "center", letterSpacing: "-0.03em" }}>
        One <span style={{ color: ACCENT }}>surprise</span>.
      </h3>
      <Qr src={qr} size="34mm" caption="Scan to join" />
      <Mono style={{ fontSize: 8.5, color: INK_SOFT, textAlign: "center" }}>No app · Opens in your browser</Mono>
    </>
  )
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: "6mm", padding: "12mm 0 24mm" }}>
      <div style={{ display: "flex", alignItems: "flex-start", perspective: "1600px" }}>
        <div style={{ ...panel, transform: "rotateY(38deg)", transformOrigin: "right center", boxShadow: "-6px 12px 22px rgba(33,28,22,0.26)" }}>{inner}</div>
        <div style={{ ...panel, transform: "rotateY(-38deg)", transformOrigin: "left center", boxShadow: "6px 12px 22px rgba(33,28,22,0.26)" }}>{inner}</div>
      </div>
      <div style={{ width: "230mm", height: 3, background: "rgba(33,28,22,0.12)", filter: "blur(1px)" }} />
    </div>
  )
}

export default async function TableTentPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const png = await renderQrCodePng("https://nabaperks.com/q/old-crown-girton", 900)
  const qr = `data:image/png;base64,${png.toString("base64")}`

  const label = { fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: INK_SOFT }

  return (
    <main style={{ background: PAPER2, minHeight: "100dvh", padding: "16mm", display: "grid", gap: "18mm", justifyItems: "center" }}>
      <div style={{ display: "grid", gap: "10mm", justifyItems: "center" }}>
        <p style={label}>A5 table tent — three concepts (one face shown; the tent is double-sided)</p>
        <div style={{ display: "flex", gap: "16mm", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
          <TentNight qr={qr} />
          <TentEditorial qr={qr} />
          <TentTicket qr={qr} />
        </div>
      </div>
      <div data-testid="standing" style={{ display: "grid", gap: "8mm", justifyItems: "center" }}>
        <p style={label}>How it stands — folded A5 tent, both sides of the table see it</p>
        <StandingTent qr={qr} />
      </div>
    </main>
  )
}
