import { Sparkline } from "nabaperks"

const RISING = [4, 6, 5, 8, 9, 7, 11, 12, 10, 14, 13, 16, 18, 21]
const FALLING = [22, 19, 21, 17, 15, 16, 12, 13, 10, 9, 11, 7, 6, 5]

export const Default = () => (
  <div className="max-w-40">
    <Sparkline data={RISING} aria-label="Stamps issued, last 14 days, rising" />
  </div>
)

export const Colours = () => (
  <div className="grid max-w-xs gap-4">
    <div className="grid gap-1">
      <span className="font-mono text-xs text-muted-foreground uppercase">Rising · leaf</span>
      <Sparkline data={RISING} color="var(--reward)" height={28} />
    </div>
    <div className="grid gap-1">
      <span className="font-mono text-xs text-muted-foreground uppercase">Falling · destructive</span>
      <Sparkline data={FALLING} color="var(--destructive)" height={28} />
    </div>
    <div className="grid gap-1">
      <span className="font-mono text-xs text-muted-foreground uppercase">Line only</span>
      <Sparkline data={RISING} fill={false} height={28} />
    </div>
  </div>
)

export const NotEnoughData = () => (
  <div className="max-w-40">
    <Sparkline data={[12]} aria-label="Not enough data yet" />
  </div>
)
