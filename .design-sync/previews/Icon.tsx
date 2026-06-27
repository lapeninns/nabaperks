import { Icon } from "nabaperks"
import {
  Coffee01Icon,
  GiftIcon,
  Store01Icon,
  Stamp01Icon,
  QrCode01Icon,
} from "@hugeicons/core-free-icons"

export const Default = () => <Icon icon={Coffee01Icon} />

export const Glyphs = () => (
  <div className="flex flex-wrap items-center gap-4 text-foreground">
    <Icon icon={Coffee01Icon} label="Coffee" />
    <Icon icon={GiftIcon} label="Reward" />
    <Icon icon={Store01Icon} label="Venue" />
    <Icon icon={Stamp01Icon} label="Stamp" />
    <Icon icon={QrCode01Icon} label="Scan" />
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-4 text-foreground">
    <Icon icon={Coffee01Icon} size={16} />
    <Icon icon={Coffee01Icon} size={20} />
    <Icon icon={Coffee01Icon} size={28} />
    <Icon icon={Coffee01Icon} size={40} strokeWidth={1.75} />
  </div>
)

export const OnSpot = () => (
  <span className="grid size-11 place-items-center rounded-full border-2 border-ink bg-primary text-primary-foreground shadow-xs">
    <Icon icon={GiftIcon} size={22} label="Free flat white" />
  </span>
)
