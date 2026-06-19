import type { Metadata } from "next"
import type { ReactNode } from "react"
import { CheckmarkBadge04Icon, GiftIcon } from "@hugeicons/core-free-icons"

import {
  ACTIVITY_CATEGORY_ICON,
  EmptyState,
  Eyebrow,
  Icon,
  Logo,
  MetricTile,
  MonoTag,
  PageTitle,
  ReceiptCard,
  SectionHeader,
  STATUS_ICON,
  VenueMark,
} from "@/components/brand"
import { AdminRecordCard } from "@/components/admin/record-card"
import { StatusPill } from "@/components/admin/support"
import { DataTable } from "@/components/data/data-table"
import {
  ProgressTrack,
  QrFrame,
  RewardCelebration,
  RewardChip,
  RewardSeal,
  RewardTicket,
  StampDot,
  StampGrid,
  StampJourneyPreview,
  StatusBanner,
  type RewardSealState,
  type RewardSlotState,
  type RewardTicketState,
} from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MotionPlayground } from "./motion-playground"

export const metadata: Metadata = {
  title: "Design system — Wet Ink catalog",
  robots: { index: false, follow: false },
}

/** A catalog section with a heading and a panel of examples. */
function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-5">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {children}
    </section>
  )
}

const COLOR_TOKENS: { name: string; className: string; ink?: boolean }[] = [
  { name: "ink", className: "bg-ink" },
  { name: "paper", className: "bg-paper", ink: true },
  { name: "paper-deep", className: "bg-paper-deep", ink: true },
  { name: "card", className: "bg-card", ink: true },
  { name: "primary (vermillion)", className: "bg-primary" },
  { name: "reward (leaf)", className: "bg-reward" },
  { name: "seal (sun)", className: "bg-seal", ink: true },
  { name: "stamp", className: "bg-stamp" },
  { name: "qr", className: "bg-qr" },
  { name: "secondary", className: "bg-secondary", ink: true },
  { name: "muted", className: "bg-muted", ink: true },
  { name: "destructive", className: "bg-destructive" },
]

const RADIUS_TOKENS = ["rounded-md", "rounded-lg", "rounded-xl", "rounded-full"]

const SHADOW_TOKENS = [
  { name: "shadow-xs", className: "shadow-xs" },
  { name: "shadow-sm", className: "shadow-sm" },
  {
    name: "offset (button)",
    className: "shadow-[3px_3px_0_var(--w-shadow-color)]",
  },
  {
    name: "offset (card)",
    className: "shadow-[4px_4px_0_var(--w-shadow-color)]",
  },
]

const MOTION_TOKENS = [
  ["press", "90ms"],
  ["move / sheet", "320ms"],
  ["stamp slam", "380ms"],
  ["paper shake", "300ms"],
]

const SEAL_STATES: RewardSealState[] = [
  "sealed",
  "waiting",
  "ready",
  "redeemed",
]
const TICKET_STATES: RewardTicketState[] = [
  "sealed",
  "waiting",
  "ready",
  "redeemed",
]
const REWARD_CHIP_STATES: RewardSlotState[] = ["locked", "ready", "revealed"]

/** Deterministic demo QR matrix — no randomness, stable across renders. */
const QR_CELLS = Array.from(
  { length: 100 },
  (_, i) => (i * 7 + (i % 5)) % 3 === 0
)

/** Mock console rows — DB-free, mirrors the shape of an admin support readback. */
type ConsoleRow = {
  id: string
  member: string
  merchant: string
  stamps: string
  status: "good" | "warning"
  joined: string
}

const CONSOLE_ROWS: ConsoleRow[] = [
  {
    id: "row-1",
    member: "07••• ••421",
    merchant: "The Old Crown",
    stamps: "5 current · 18 total",
    status: "good",
    joined: "12 May 2026",
  },
  {
    id: "row-2",
    member: "j••@••.uk",
    merchant: "Brew & Bean",
    stamps: "2 current · 4 total",
    status: "warning",
    joined: "03 Jun 2026",
  },
]

export default function DesignSystemPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-10">
      <PageTitle
        eyebrow="Wet Ink · Honey & Ink v2"
        title="Design system catalog"
        description="The acceptance gate for the foundation layer: tokens, typography, surfaces, motion primitives, and the loyalty vocabulary. Every motion primitive renders static children under prefers-reduced-motion."
        actions={<MonoTag tone="accent">Dev only</MonoTag>}
      />

      <Section
        id="tokens"
        eyebrow="Foundation"
        title="Tokens"
        description="Spot inks, radii, hard offset shadows, and motion timings — all driven by the --w-* palette in globals.css."
      >
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <div
              key={token.name}
              className="grid gap-2 rounded-lg border-2 border-ink bg-card p-3"
            >
              <span
                className={cn(
                  "h-12 rounded-md border-2 border-ink",
                  token.className
                )}
              />
              <span className="font-mono text-[0.7rem] font-bold tracking-[0.04em] uppercase">
                {token.name}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-4">
            <Eyebrow>Radius</Eyebrow>
            <div className="flex flex-wrap items-end gap-3">
              {RADIUS_TOKENS.map((radius) => (
                <span key={radius} className="grid justify-items-center gap-1">
                  <span
                    className={cn(
                      "size-12 border-2 border-ink bg-secondary",
                      radius
                    )}
                  />
                  <span className="font-mono text-[0.6rem] text-muted-foreground">
                    {radius}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-4">
            <Eyebrow>Shadow</Eyebrow>
            <div className="flex flex-wrap items-end gap-4">
              {SHADOW_TOKENS.map((shadow) => (
                <span
                  key={shadow.name}
                  className="grid justify-items-center gap-1"
                >
                  <span
                    className={cn(
                      "size-12 rounded-md border-2 border-ink bg-card",
                      shadow.className
                    )}
                  />
                  <span className="max-w-16 text-center font-mono text-[0.6rem] text-muted-foreground">
                    {shadow.name}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-4">
            <Eyebrow>Motion timing</Eyebrow>
            <dl className="grid gap-1.5">
              {MOTION_TOKENS.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="numeric-tabular font-mono text-sm font-bold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section
        id="typography"
        eyebrow="Foundation"
        title="Typography & tags"
        description="Display headings, the mono eyebrow, metric tiles, and the MonoTag tones."
      >
        <div className="grid gap-5 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Eyebrow / mono caption</Eyebrow>
          <PageTitle
            eyebrow="Page title"
            title="Loyalty, stamped before the coffee cools"
            description="The display face at page scale — weight 800, tight leading."
          />
          <SectionHeader
            eyebrow="Section header"
            title="A section within a page"
            description="One step down from the page title."
          />
          <div className="flex flex-wrap gap-2">
            {(["plain", "accent", "ink", "leaf", "sun"] as const).map(
              (tone) => (
                <MonoTag key={tone} tone={tone}>
                  {tone}
                </MonoTag>
              )
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Members"
              value="248"
              icon={CheckmarkBadge04Icon}
            />
            <MetricTile label="Stamps today" value="31" />
            <MetricTile
              label="Rewards ready"
              value="4"
              helper="Across all cards"
            />
          </div>
          <div className="grid gap-2">
            <Eyebrow>Tags with icons</Eyebrow>
            <div className="flex flex-wrap gap-2">
              <MonoTag tone="leaf" icon={GiftIcon}>
                Reward
              </MonoTag>
              <MonoTag tone="plain" icon={CheckmarkBadge04Icon}>
                Stamped
              </MonoTag>
              <MonoTag tone="accent" icon={GiftIcon}>
                Mystery
              </MonoTag>
            </div>
          </div>
          <div className="grid gap-2">
            <Eyebrow>Empty state</Eyebrow>
            <div className="grid gap-3 sm:grid-cols-2">
              <EmptyState
                icon={GiftIcon}
                title="No rewards yet"
                description="Rewards you earn show up here once a card is full."
                actions={
                  <Button variant="outline" className="pressable">
                    View cards
                  </Button>
                }
              />
              <EmptyState
                title="No activity yet"
                description="Stamps and rewards appear here as you collect them."
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="surfaces"
        eyebrow="Foundation"
        title="Surfaces & buttons"
        description="The receipt card (plain, torn edge, tilted), the venue stamp mark, and the tactile button family."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ReceiptCard className="grid gap-1 p-5">
            <Eyebrow>Receipt card</Eyebrow>
            <p className="text-base font-extrabold">Plain surface</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Ink border, hard offset shadow.
            </p>
          </ReceiptCard>
          <ReceiptCard edge className="grid gap-1 p-5">
            <Eyebrow>Receipt card</Eyebrow>
            <p className="text-base font-extrabold">Torn edge</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Perforated zigzag below.
            </p>
          </ReceiptCard>
          <ReceiptCard rotated className="grid gap-1 p-5">
            <Eyebrow>Receipt card</Eyebrow>
            <p className="text-base font-extrabold">Tilted</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Stamp-family off-square.
            </p>
          </ReceiptCard>
        </div>

        <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Logo &amp; identity marks</Eyebrow>
          <div className="flex flex-wrap items-center gap-5">
            <Logo />
            <Logo compact />
            <VenueMark size={56} />
            <VenueMark name="The Old Crown" size={56} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <VenueMark size={56} />
          <div className="flex flex-wrap gap-3">
            {(
              [
                "default",
                "stamp",
                "reward",
                "secondary",
                "outline",
                "ghost",
                "link",
              ] as const
            ).map((variant) => (
              <Button key={variant} variant={variant} className="pressable">
                {variant}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="iconography"
        eyebrow="Foundation"
        title="Iconography"
        description="The @hugeicons free set is the single icon system. The Icon wrapper applies house defaults (2 px stroke, current colour, no shrink) and accepts an accessible label for non-decorative uses. The two semantic maps give every status kind and activity category a canonical glyph."
      >
        <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Icon wrapper · size variants</Eyebrow>
          <div className="flex flex-wrap items-end gap-6">
            {[16, 20, 28].map((px) => (
              <div key={px} className="grid justify-items-center gap-2">
                <Icon
                  icon={GiftIcon}
                  size={px}
                  label={`Gift icon, ${px} pixels`}
                />
                <MonoTag>{px}</MonoTag>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
            <Eyebrow>Status icons</Eyebrow>
            <div className="flex flex-wrap gap-4">
              {Object.entries(STATUS_ICON).map(([key, glyph]) => (
                <div key={key} className="grid justify-items-center gap-2">
                  <Icon icon={glyph} size={24} label={`${key} status`} />
                  <MonoTag>{key}</MonoTag>
                </div>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
            <Eyebrow>Activity category icons</Eyebrow>
            <div className="flex flex-wrap gap-4">
              {Object.entries(ACTIVITY_CATEGORY_ICON).map(([key, glyph]) => (
                <div key={key} className="grid justify-items-center gap-2">
                  <Icon icon={glyph} size={24} label={`${key} activity`} />
                  <MonoTag>{key}</MonoTag>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="motion"
        eyebrow="Foundation"
        title="Motion primitives"
        description="The WetInk* Framer library. Press Replay to re-fire a beat. Under prefers-reduced-motion every primitive renders its static child — nothing blanks out."
      >
        <MotionPlayground />
      </Section>

      <Section
        id="loyalty"
        eyebrow="Foundation"
        title="Loyalty vocabulary"
        description="One stamp/reward system: the stamp grid, the single seal at three sizes and four states, the reward ticket, status banners, progress, and the QR frame."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
            <Eyebrow>Stamp grid</Eyebrow>
            <StampGrid current={2} total={6} venueName="The Old Crown" />
            <StampGrid
              current={5}
              total={6}
              rewardSlot="ready"
              venueName="The Old Crown"
            />
          </div>
          <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
            <Eyebrow>Join journey preview</Eyebrow>
            <StampJourneyPreview total={6} venueName="The Old Crown" />
            <p className="text-xs leading-5 text-muted-foreground">
              Loops the empty → full → seal beat; static when reduced motion is
              on.
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Stamp dot · anatomy</Eyebrow>
          <div className="flex flex-wrap gap-6">
            <div className="grid justify-items-center gap-2">
              <div className="w-12">
                <StampDot
                  earned
                  label="Stamp 1 earned"
                  venueName="The Old Crown"
                  date="17 Jun"
                />
              </div>
              <MonoTag>earned</MonoTag>
            </div>
            <div className="grid justify-items-center gap-2">
              <div className="w-12">
                <StampDot
                  earned={false}
                  label="Stamp 2 empty"
                  slotNumber={2}
                  showEmptySlotNumber
                />
              </div>
              <MonoTag>empty</MonoTag>
            </div>
            <div className="grid justify-items-center gap-2">
              <div className="w-9">
                <StampDot
                  earned
                  compact
                  label="Stamp 1 earned"
                  venueName="The Old Crown"
                  date="17 Jun"
                />
              </div>
              <MonoTag>compact earned</MonoTag>
            </div>
            <div className="grid justify-items-center gap-2">
              <div className="w-9">
                <StampDot
                  earned={false}
                  compact
                  label="Stamp 2 empty"
                  slotNumber={2}
                  showEmptySlotNumber
                />
              </div>
              <MonoTag>compact empty</MonoTag>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Reward chip · three states</Eyebrow>
          <div className="flex flex-wrap gap-6">
            {REWARD_CHIP_STATES.map((state) => (
              <div key={state} className="grid justify-items-center gap-2">
                <div className="w-12">
                  <RewardChip slotState={state} />
                </div>
                <MonoTag>{state}</MonoTag>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Reward seal · four states · three sizes</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-4">
            {SEAL_STATES.map((state) => (
              <div key={state} className="grid justify-items-center gap-3">
                <div className="flex items-end gap-3">
                  <RewardSeal state={state} size="sm" />
                  <RewardSeal state={state} size="md" />
                  <RewardSeal state={state} size="lg" />
                </div>
                <MonoTag>{state}</MonoTag>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <Eyebrow>Reward ticket · the same chit in four states</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2">
            {TICKET_STATES.map((state) => (
              <RewardTicket
                key={state}
                state={state}
                name={state === "sealed" ? "Mystery reward" : "Free hot drink"}
                description="On the house, redeemable from the next UK business day."
                readyDate={state === "waiting" ? "Tue 18 Jun" : undefined}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
            <Eyebrow>Status banners</Eyebrow>
            <StatusBanner tone="success" title="Stamp added">
              That is one stamp on your card.
            </StatusBanner>
            <StatusBanner tone="warning" title="Already stamped today">
              Come back tomorrow for your next stamp.
            </StatusBanner>
            <StatusBanner tone="error" title="Could not reach the venue">
              Check your connection and try again.
            </StatusBanner>
            <StatusBanner tone="neutral" title="Card saved">
              Your card lives on this phone.
            </StatusBanner>
          </div>
          <div className="grid content-start gap-5 rounded-lg border-2 border-ink bg-card p-5">
            <div className="grid gap-2">
              <Eyebrow>Progress track</Eyebrow>
              <ProgressTrack current={2} total={6} label="Stamps" />
            </div>
            <div className="grid gap-2">
              <Eyebrow>QR frame</Eyebrow>
              <QrFrame label="Demo QR code" className="w-fit">
                <div className="grid aspect-square w-28 grid-cols-10 gap-[2px]">
                  {QR_CELLS.map((cell, index) => (
                    <span
                      key={index}
                      className={
                        cell ? "rounded-[1px] bg-qr" : "bg-transparent"
                      }
                    />
                  ))}
                </div>
              </QrFrame>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <Eyebrow>Card-complete celebration</Eyebrow>
          <div className="max-w-md">
            <RewardCelebration
              title="Your card is full"
              message="The seal is ready to break on your next visit."
            />
          </div>
        </div>
      </Section>

      <Section
        id="console-data"
        eyebrow="Console"
        title="Console data tables & record cards"
        description="The responsive admin list pattern. DataTable renders a semantic table at sm and above; below sm it renders a stacked AdminRecordCard per row via the mobileCard renderer, so dense support data reads on a phone without horizontal scroll. Shared by 7+ admin tables (customers, merchants, fraud, billing, audit, pilot, privacy). Resize below the sm breakpoint to see the table become cards."
      >
        <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Responsive DataTable · table at sm+, cards below</Eyebrow>
          <DataTable
            caption="Demo console membership readback"
            rows={CONSOLE_ROWS}
            getRowKey={(row) => row.id}
            emptyState={
              <EmptyState
                title="No records yet"
                description="Rows appear here once a readback returns data."
              />
            }
            mobileCard={(row) => (
              <AdminRecordCard
                title={row.member}
                status={<StatusPill tone={row.status}>{row.status}</StatusPill>}
                fields={[
                  { label: "Merchant", value: row.merchant },
                  { label: "Stamps", value: row.stamps },
                  { label: "Joined", value: row.joined, mono: true },
                ]}
                action={
                  <Button variant="outline" className="pressable w-full">
                    Adjust stamps
                  </Button>
                }
              />
            )}
            columns={[
              {
                key: "member",
                header: "Member",
                cell: (row) => (
                  <div className="grid gap-1">
                    <span className="font-bold">{row.member}</span>
                    <span className="text-muted-foreground">
                      {row.merchant}
                    </span>
                  </div>
                ),
              },
              {
                key: "stamps",
                header: "Stamps",
                cell: (row) => (
                  <span className="numeric-tabular">{row.stamps}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <StatusPill tone={row.status}>{row.status}</StatusPill>
                ),
              },
              {
                key: "joined",
                header: "Joined",
                cell: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.joined}
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="grid gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>AdminRecordCard · the mobile renderer in isolation</Eyebrow>
          <p className="text-sm leading-6 text-muted-foreground">
            Title, optional status, stacked label/value fields, and a full-width
            action. Per-row support actions live in the card body so they are
            reachable without horizontal scroll.
          </p>
          <div className="max-w-sm">
            <AdminRecordCard
              eyebrow="MEMBERSHIP"
              title="07••• ••421"
              status={<StatusPill tone="good">active</StatusPill>}
              fields={[
                { label: "Merchant", value: "The Old Crown" },
                { label: "Stamps", value: "5 current · 18 total" },
                { label: "Membership id", value: "mbr_0f3a91", mono: true },
              ]}
              action={
                <Button variant="outline" className="pressable w-full">
                  Adjust stamps
                </Button>
              }
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
