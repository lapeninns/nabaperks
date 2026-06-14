import type { ReactNode } from "react"

import {
  CustomerActionNote,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { Button } from "@/components/ui/button"
import {
  advanceOneStampAction,
  advanceTwoStampsAction,
  advanceZeroStampsAction,
  makeRewardRedeemableAction,
  resetDemoCustomerAction,
} from "@/app/dev/customer-flow/actions"
import type { CustomerFlowStatus } from "@/lib/dev/customer-flow-demo"

export function PlaybookHero({
  status,
}: {
  readonly status: CustomerFlowStatus
}) {
  return (
    <section className="overflow-hidden rounded-lg border-2 border-ink bg-ink text-paper shadow-xs">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <MonoChip>Full flow</MonoChip>
            <MonoChip>{status.qrId}</MonoChip>
            <MonoChip>{status.merchantSlug}</MonoChip>
          </div>
          <div className="grid gap-3">
            <h2 className="text-3xl leading-[0.95] font-black text-balance sm:text-5xl">
              Deal out the customer journey as a live playbook.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-paper/75 sm:text-base">
              Tap any card to jump into that exact screen. Use the control panel
              to set the demo state, then walk scan, join, stamp, card, reward,
              and redeemed views without leaving the route map.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1">
          <HeroStat label="screens" value="11" />
          <HeroStat label="stamp rule" value="1/day" />
          <HeroStat label="reward" value="next day" />
        </dl>
      </div>
    </section>
  )
}

export function StatusPanel({
  status,
}: {
  readonly status: CustomerFlowStatus
}) {
  const reward = status.latestReward

  return (
    <CustomerReceipt
      venueName="Bean & Batch"
      title="Demo readout"
      eyebrow="Live state"
      footerLeft={`QR ${status.qrId}`}
      footerRight={status.merchantSlug}
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Readout label="Phone" value={status.phone} />
        <Readout
          label="Membership"
          value={status.membershipId ?? "Not joined"}
        />
        <Readout
          label="Current stamps"
          value={String(status.currentStampCount)}
        />
        <Readout
          label="Latest reward"
          value={reward ? `${reward.id} / ${reward.status}` : "No reward yet"}
        />
        <Readout
          label="Redeemable from"
          value={reward?.redeemableFrom ?? "Not available"}
        />
        <Readout
          label="Last business day"
          value={status.latestBusinessDate ?? "Not stamped yet"}
        />
      </dl>
    </CustomerReceipt>
  )
}

export function ActionsPanel() {
  return (
    <section className="surface-card grid gap-4 p-5">
      <div className="grid gap-1">
        <p className="eyebrow">Set the scene</p>
        <h2 className="text-xl leading-tight font-extrabold">Demo controls</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <form action={resetDemoCustomerAction} className="col-span-2">
          <Button type="submit" variant="destructive" className="w-full">
            Reset customer
          </Button>
        </form>
        <ActionForm action={advanceZeroStampsAction} label="Advance 0" />
        <ActionForm action={advanceOneStampAction} label="Advance 1" />
        <ActionForm action={advanceTwoStampsAction} label="Advance 2" />
        <ActionForm action={makeRewardRedeemableAction} label="Make ready" />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Advance buttons reshape the seeded customer state. The cards below open
        the real customer routes for that state.
      </p>
    </section>
  )
}

export function PlayFlowHint({
  otpCode,
  status,
}: {
  readonly otpCode: string
  readonly status: CustomerFlowStatus
}) {
  return (
    <CustomerActionNote title="Playbook brief" tone="accent">
      Phone {status.phone}; OTP {otpCode}; QR {status.qrId}; merchant{" "}
      {status.merchantSlug}.
    </CustomerActionNote>
  )
}

function ActionForm({
  action,
  label,
}: {
  readonly action: () => Promise<never>
  readonly label: string
}) {
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" className="w-full">
        {label}
      </Button>
    </form>
  )
}

function MonoChip({ children }: { readonly children: ReactNode }) {
  return (
    <span className="rounded-full border border-paper/25 px-3 py-1 font-mono text-[0.65rem] font-bold text-paper/80 uppercase">
      {children}
    </span>
  )
}

function HeroStat({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-lg border-2 border-paper/20 bg-paper/10 p-3">
      <dt className="font-mono text-[0.6rem] font-bold text-paper/60 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-lg leading-none font-black">{value}</dd>
    </div>
  )
}

function Readout({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="grid gap-1">
      <dt className="font-mono text-[0.625rem] font-bold text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="font-extrabold break-all">{value}</dd>
    </div>
  )
}
