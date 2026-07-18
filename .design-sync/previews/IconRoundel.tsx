import { IconRoundel } from "nabaperks"
import {
  Coffee01Icon,
  GiftIcon,
  QrCode01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"

export const Tones = () => (
  <div className="flex items-center gap-3">
    <IconRoundel icon={Coffee01Icon} tone="secondary" label="Coffee" />
    <IconRoundel icon={GiftIcon} tone="accent" label="Reward" />
    <IconRoundel icon={QrCode01Icon} tone="card" label="QR code" />
    <IconRoundel icon={Store01Icon} tone="primary" label="Venue" />
  </div>
)

export const Sizes = () => (
  <div className="flex items-end gap-3">
    <IconRoundel icon={Coffee01Icon} size="sm" label="Small" />
    <IconRoundel icon={Coffee01Icon} size="md" label="Medium" />
    <IconRoundel icon={Coffee01Icon} size="lg" label="Large" />
  </div>
)

export const StepNumbers = () => (
  <div className="grid max-w-xs gap-3">
    {(
      [
        { step: "1", copy: "Scan the counter QR" },
        { step: "2", copy: "Collect a stamp per visit" },
        { step: "3", copy: "Unseal your mystery reward" },
      ] as const
    ).map((row) => (
      <div key={row.step} className="flex items-center gap-3">
        <IconRoundel size="sm" tone="secondary">
          <span className="font-mono text-xs font-bold">{row.step}</span>
        </IconRoundel>
        <span className="text-sm font-semibold">{row.copy}</span>
      </div>
    ))}
  </div>
)
