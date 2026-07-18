import { MemberMark, ShowMoreList } from "nabaperks"

const MEMBERS = [
  { key: "pm", initials: "PM", name: "Priya Modi", meta: "7 of 8 stamps" },
  { key: "th", initials: "TH", name: "Tom Hartley", meta: "3 of 8 stamps" },
  { key: "ew", initials: "EW", name: "Ellie Watts", meta: "Reward ready" },
  { key: "as", initials: "AS", name: "Aiden Shaw", meta: "1 of 8 stamps" },
  { key: "jb", initials: "JB", name: "Jo Bell", meta: "5 of 8 stamps" },
  { key: "ko", initials: "KO", name: "Kemi Okafor", meta: "2 of 8 stamps" },
  { key: "lf", initials: "LF", name: "Luca Ferri", meta: "6 of 8 stamps" },
  { key: "sd", initials: "SD", name: "Sam Doyle", meta: "4 of 8 stamps" },
].map((m) => ({
  key: m.key,
  content: (
    <div className="flex items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 shadow-xs">
      <MemberMark initials={m.initials} />
      <div className="grid">
        <span className="text-sm font-semibold">{m.name}</span>
        <span className="font-mono text-xs text-muted-foreground uppercase">{m.meta}</span>
      </div>
    </div>
  ),
}))

export const Default = () => (
  <div className="max-w-sm">
    <ShowMoreList items={MEMBERS} initialCount={3} label="Members" />
  </div>
)

export const FullyRevealed = () => (
  <div className="max-w-sm">
    <ShowMoreList
      items={MEMBERS.slice(0, 3)}
      initialCount={3}
      label="Members joined this week"
    />
  </div>
)
