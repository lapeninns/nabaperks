import { Logo } from "nabaperks"

export const Default = () => <Logo />

export const Compact = () => <Logo compact />

export const Lineup = () => (
  <div className="flex flex-col items-start gap-4">
    <Logo />
    <Logo compact />
    <Logo label="Bridge Street Coffee" />
  </div>
)

export const InHeader = () => (
  <header className="flex items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-card px-4 py-3 shadow-xs">
    <Logo wordmarkClassName="hidden sm:inline" />
    <span className="font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
      Counter
    </span>
  </header>
)
