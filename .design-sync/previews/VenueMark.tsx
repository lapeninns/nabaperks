import { VenueMark } from "nabaperks"

export const Default = () => <VenueMark name="Bridge Street Coffee" />

export const FromInitials = () => <VenueMark initials="BS" caption="Bridge Street" />

export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-4">
    <VenueMark name="Old Crown Girton" size={40} />
    <VenueMark name="Old Crown Girton" size={56} />
    <VenueMark name="Old Crown Girton" size={72} />
  </div>
)

export const Roundels = () => (
  <div className="flex flex-wrap gap-5">
    <VenueMark name="Bridge Street Coffee" caption="Bridge Street" />
    <VenueMark name="Old Crown Girton" caption="Old Crown" />
    <VenueMark name="Norfolk Street Bakery" caption="Norfolk St" />
  </div>
)
