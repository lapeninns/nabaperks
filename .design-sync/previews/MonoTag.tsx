import { MonoTag } from "nabaperks"
import { Coffee01Icon, GiftIcon, QrCode01Icon } from "@hugeicons/core-free-icons"

export const Default = () => <MonoTag>Member</MonoTag>

export const Tones = () => (
  <div className="flex flex-wrap items-center gap-2">
    <MonoTag tone="plain">Order #4821</MonoTag>
    <MonoTag tone="accent">8 stamps</MonoTag>
    <MonoTag tone="ink">Counter</MonoTag>
    <MonoTag tone="leaf">Reward ready</MonoTag>
    <MonoTag tone="sun">Founding member</MonoTag>
  </div>
)

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-2">
    <MonoTag tone="accent" icon={Coffee01Icon}>
      Flat white
    </MonoTag>
    <MonoTag tone="leaf" icon={GiftIcon}>
      Free pastry
    </MonoTag>
    <MonoTag tone="ink" icon={QrCode01Icon}>
      Scan to join
    </MonoTag>
  </div>
)
