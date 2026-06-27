// Scoped Wet Ink design-system entry for /design-sync (synth bundle entry).
// Re-exports ONLY the reusable primitive surface (ui + brand + loyalty + data +
// forms) so the IIFE bundle stays clean and excludes app/feature code
// (customer flows, QR scanner, merchant/admin shells) that pulls server-only /
// next-navigation / html5-qrcode deps. Compound sub-parts (CardHeader,
// TabsList, SidebarProvider, …) ride along via `export *` and resolve from
// window.WetInk even though only the ~47 primaries get preview cards
// (see .design-sync/config.json componentSrcMap).

// ── ui primitives (shadcn / radix-rhea) ──────────────────────────────
export * from "../components/ui/alert"
export * from "../components/ui/badge"
export * from "../components/ui/button"
export * from "../components/ui/card"
export * from "../components/ui/empty"
export * from "../components/ui/field"
export * from "../components/ui/input"
export * from "../components/ui/input-group"
export * from "../components/ui/input-otp"
export * from "../components/ui/label"
export * from "../components/ui/progress"
export * from "../components/ui/separator"
export * from "../components/ui/sheet"
export * from "../components/ui/sidebar"
export * from "../components/ui/skeleton"
export * from "../components/ui/sonner"
export * from "../components/ui/spinner"
export * from "../components/ui/table"
export * from "../components/ui/tabs"
export * from "../components/ui/textarea"

// ── domain primitives (barrel re-exports) ────────────────────────────
export * from "../components/brand"
export * from "../components/loyalty"
export * from "../components/data"
export * from "../components/forms"
