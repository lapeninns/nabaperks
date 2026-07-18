import { Icon, StatStrip } from "nabaperks"
import {
  Coffee01Icon,
  GiftIcon,
  Store01Icon,
  QrCode01Icon,
} from "@hugeicons/core-free-icons"

export const ThisWeek = () => (
  <div className="max-w-2xl">
    <StatStrip
      items={[
        {
          label: "New members",
          value: "12",
          tone: "cobalt",
          icon: <Icon icon={Store01Icon} size={13} strokeWidth={2.25} />,
        },
        {
          label: "Stamps",
          value: "118",
          tone: "primary",
          icon: <Icon icon={Coffee01Icon} size={13} strokeWidth={2.25} />,
        },
        {
          label: "Rewards",
          value: "9",
          tone: "leaf",
          icon: <Icon icon={GiftIcon} size={13} strokeWidth={2.25} />,
        },
        {
          label: "QR scans",
          value: "64",
          tone: "sun",
          icon: <Icon icon={QrCode01Icon} size={13} strokeWidth={2.25} />,
        },
      ]}
    />
  </div>
)

export const ThreeUp = () => (
  <div className="max-w-xl">
    <StatStrip
      items={[
        { label: "Active cards", value: "92", tone: "ink" },
        { label: "Close to reward", value: "21", tone: "leaf" },
        { label: "Lapsed", value: "35" },
      ]}
    />
  </div>
)
