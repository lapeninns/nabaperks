import { MemberMark } from "nabaperks"

export const Tones = () => (
  <div className="grid max-w-sm grid-cols-3 gap-x-3 gap-y-4">
    {(
      [
        { tone: "collecting", who: "PM", caption: "Collecting" },
        { tone: "ready", who: "EW", caption: "Reward ready" },
        { tone: "waiting", who: "TH", caption: "Unseals Mon" },
        { tone: "new", who: "AS", caption: "New this week" },
        { tone: "quiet", who: "JB", caption: "Quiet 30d+" },
        { tone: "redeemed", who: "KO", caption: "Redeemed" },
      ] as const
    ).map((m) => (
      <div key={m.who} className="grid justify-items-center gap-1.5 text-center">
        <MemberMark initials={m.who} tone={m.tone} label={m.caption} />
        <span className="font-mono text-[0.625rem] text-muted-foreground uppercase">
          {m.caption}
        </span>
      </div>
    ))}
  </div>
)

export const InMemberRow = () => (
  <div className="grid max-w-sm gap-2">
    {(
      [
        { initials: "PM", name: "Priya Modi", meta: "7 of 8 stamps", tone: "ready" },
        { initials: "TH", name: "Tom Hartley", meta: "3 of 8 stamps", tone: "collecting" },
        { initials: "JB", name: "Jo Bell", meta: "Last visit 6 weeks ago", tone: "quiet" },
      ] as const
    ).map((m) => (
      <div
        key={m.initials}
        className="flex items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 shadow-xs"
      >
        <MemberMark initials={m.initials} tone={m.tone} />
        <div className="grid">
          <span className="text-sm font-semibold">{m.name}</span>
          <span className="font-mono text-xs text-muted-foreground uppercase">{m.meta}</span>
        </div>
      </div>
    ))}
  </div>
)
