"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import {
  Download04Icon,
  QrCode01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"

import {
  offerCampaignFormAction,
  type OfferNoticeCode,
  type OfferNoticeFlag,
} from "@/app/app/offers/actions"
import {
  Eyebrow,
  Icon,
  MetricTile,
  MonoTag,
  SectionHeader,
} from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import {
  OfferRulesSummary,
  formatOfferDate,
} from "@/components/merchant/offers/offer-rules-summary"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MerchantOfferCampaign } from "@/lib/merchant/offer-campaigns"
import type { OfferCampaignStatus } from "@/lib/offers/constants"

/**
 * The management face of a venue's single live offer: the confidential link,
 * the campaign QR, the lifecycle controls and the counts that were actually
 * recorded.
 *
 * The face is a compact header plus three tabs — Share, Manage and Results —
 * so the screen a merchant works from at the counter is never one tall card.
 * The header and its status banners stay visible on every tab: what the offer
 * is called, whether it can be claimed right now, and what it is waiting for.
 * Share is offered only when there is a working link to share (never for a
 * draft, and suppressed on the QR screen, which shows the link in its own
 * hero); the default tab is the first useful one, so a draft lands on Manage
 * and its publish flow.
 *
 * Three honesty rules are load-bearing here:
 *   * The link shown is the one the customer landing page will accept, or none
 *     at all — `resolveOfferClaimLink` upstream returns null rather than a
 *     plausible-looking link that would 404, and this panel renders a calm
 *     recovery state for that case.
 *   * Pausing and ending stop NEW claims only. Passes already issued keep their
 *     own terms and stay redeemable, and the confirmation copy says so.
 *   * The tiles report only signals this feature records, and each says what it
 *     actually counts. "Link opened" is the loose one — it counts page loads of
 *     a claimable offer, including refreshes, link previews and crawlers — so
 *     its helper text and the note under the tiles say so outright rather than
 *     letting a merchant read it as people through the door.
 */

const STATUS_TAG: Record<
  OfferCampaignStatus,
  { tone: "plain" | "cobalt" | "leaf" | "sun" | "ink"; label: string }
> = {
  draft: { tone: "plain", label: "Draft" },
  scheduled: { tone: "cobalt", label: "Scheduled" },
  live: { tone: "leaf", label: "Live" },
  paused: { tone: "sun", label: "Paused" },
  ended: { tone: "ink", label: "Ended" },
}

export type OfferCampaignPanelProps = {
  readonly campaign: MerchantOfferCampaign
  /** The working claim link, or null when no candidate matches the stored hash. */
  readonly claimUrl: string | null
  /** `/app/offers/<id>/qr` — the full-screen campaign QR. */
  readonly qrHref: string
  /** `/app/offers/<id>/qr.png` — the downloadable image. */
  readonly qrImageHref: string
  /** Posted as `returnTo` so lifecycle actions come back to this screen. */
  readonly returnTo: string
  readonly stampsRequired: number
  /** Hide the QR launcher on the QR screen itself. */
  readonly showQrLink?: boolean
  /** The QR screen shows the link in its own hero, so it suppresses this one. */
  readonly showShareRow?: boolean
}

export function OfferCampaignPanel({
  campaign,
  claimUrl,
  qrHref,
  qrImageHref,
  returnTo,
  stampsRequired,
  showQrLink = true,
  showShareRow = true,
}: OfferCampaignPanelProps) {
  const [, action] = useActionState(offerCampaignFormAction, {})
  const tag = STATUS_TAG[campaign.status]
  const isDraft = campaign.status === "draft"
  const shareable = !isDraft && claimUrl !== null
  const showShare = shareable && showShareRow

  return (
    <section className="grid min-w-0 gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[var(--shadow-hard)] sm:gap-5 sm:p-6">
      <SectionHeader
        eyebrow={campaign.name ?? "Your offer"}
        title={headline(campaign)}
        description={summary(campaign)}
        actions={<MonoTag tone={tag.tone}>{tag.label}</MonoTag>}
      />

      {isDraft ? (
        <StatusBanner tone="info" title="Nobody can claim this yet">
          Your offer is saved but not published. The link and the QR start
          working the moment you publish it.
        </StatusBanner>
      ) : null}

      {campaign.status === "paused" ? (
        <StatusBanner tone="warning" title="No new claims">
          Nobody new can claim while the offer is paused. Passes already issued
          keep working until their own end date.
        </StatusBanner>
      ) : null}

      {!isDraft && !shareable ? (
        <StatusBanner tone="warning" title="Your link needs replacing">
          We can&apos;t show a link for this offer that customers would be able
          to use. Rotate the link below to issue a working one, then reprint
          anything that carries the old one.
        </StatusBanner>
      ) : null}

      <Tabs defaultValue={showShare ? "share" : "manage"}>
        <TabsList aria-label="Offer sections">
          {showShare ? <TabsTrigger value="share">Share</TabsTrigger> : null}
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {showShare && claimUrl !== null ? (
          <TabsContent value="share">
            <ShareRow
              claimUrl={claimUrl}
              qrHref={qrHref}
              qrImageHref={qrImageHref}
              showQrLink={showQrLink}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="manage" className="gap-5">
          <OfferRulesSummary
            name={campaign.name}
            customerDescription={campaign.customerDescription}
            bonusStampCount={campaign.bonusStampCount}
            discountPercent={campaign.discountPercent}
            startsOn={campaign.startsOn}
            endsOn={campaign.endsOn}
            requiresIdCheck={campaign.requiresIdCheck}
            extraTerms={campaign.extraTerms}
            stampsRequired={stampsRequired}
            collapsed={!isDraft}
          />

          <hr className="w-rule my-0" />

          <LifecycleControls
            action={action}
            campaign={campaign}
            returnTo={returnTo}
          />
        </TabsContent>

        <TabsContent value="results">
          <CampaignMetrics campaign={campaign} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

// ─── Link and QR ──────────────────────────────────────────────────────────────

function ShareRow({
  claimUrl,
  qrHref,
  qrImageHref,
  showQrLink,
}: {
  claimUrl: string
  qrHref: string
  qrImageHref: string
  showQrLink: boolean
}) {
  return (
    <div className="grid gap-3">
      <Eyebrow>Confidential link</Eyebrow>
      <CopyLinkField claimUrl={claimUrl} />
      <p className="text-sm leading-6 text-muted-foreground">
        Anyone who opens this link can claim the offer, so put it only where you
        want it claimed.
      </p>
      <div className="flex flex-wrap gap-2">
        {showQrLink ? (
          <Button asChild variant="secondary">
            <Link href={qrHref} prefetch={false}>
              <Icon icon={QrCode01Icon} size={16} />
              Show the QR
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <a href={`${qrImageHref}?download=1`} download>
            <Icon icon={Download04Icon} size={16} />
            Download the QR image
          </a>
        </Button>
      </div>
    </div>
  )
}

/**
 * The link as a copy-field: the mono URL truncates inside an ink-bordered well
 * with the copy button inline, so the Share tab stays one compact row instead
 * of a break-all paragraph stack. If the clipboard write fails the full link
 * is revealed under the well, because a truncated URL cannot be copied by
 * hand.
 */
function CopyLinkField({ claimUrl }: { claimUrl: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(claimUrl)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      setFailed(true)
      window.setTimeout(() => setFailed(false), 2400)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border-2 border-ink bg-secondary/40 py-2 pr-2 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs leading-6 text-foreground">
          {claimUrl}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={copy}
        >
          {failed ? "Copy failed" : copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {failed ? (
        <p className="font-mono text-xs leading-5 break-all text-muted-foreground">
          {claimUrl}
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {failed
          ? "Copy failed. Use the visible link instead."
          : copied
            ? "Offer link copied."
            : ""}
      </span>
    </div>
  )
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function LifecycleControls({
  action,
  campaign,
  returnTo,
}: {
  action: (formData: FormData) => void
  campaign: MerchantOfferCampaign
  returnTo: string
}) {
  const [confirming, setConfirming] = useState<
    "publish" | "rotate" | "end" | null
  >(null)

  const isDraft = campaign.status === "draft"
  const publishing = isDraft && confirming === "publish"
  const showPause =
    campaign.status === "live" || campaign.status === "scheduled"
  const showResume = campaign.status === "paused"
  const anySubmit =
    publishing ||
    showPause ||
    showResume ||
    confirming === "rotate" ||
    confirming === "end"

  return (
    <div className="grid gap-4">
      {anySubmit ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <input type="hidden" name="returnTo" value={returnTo} />

          {/* Publishing from here locks the same things publishing from the
            creator locks, so it asks for the same acknowledgement — and the
            server refuses any publish that does not carry it. */}
          {publishing ? (
            <label className="focus-ring-within flex cursor-pointer items-start gap-3 rounded-lg border-2 border-ink bg-secondary/40 p-3">
              <input
                type="checkbox"
                name="acknowledgement"
                value="terms-locked"
                required
                className="mt-0.5 size-4 shrink-0 accent-[var(--w-leaf)]"
              />
              <span className="text-sm leading-6 text-foreground">
                I understand these terms are locked once published, and that
                only customers who are not already members can claim.
              </span>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {publishing ? (
              <SubmitButton
                name="intent"
                value="publish"
                variant="reward"
                pendingLabel="Publishing…"
              >
                Yes, publish this offer
              </SubmitButton>
            ) : null}

            {showPause ? (
              <SubmitButton
                name="intent"
                value="pause"
                variant="secondary"
                pendingLabel="Pausing…"
              >
                Pause new claims
              </SubmitButton>
            ) : null}

            {showResume ? (
              <SubmitButton
                name="intent"
                value="resume"
                variant="secondary"
                pendingLabel="Resuming…"
              >
                Accept claims again
              </SubmitButton>
            ) : null}

            {confirming === "rotate" ? (
              <SubmitButton
                name="intent"
                value="rotate"
                variant="destructive"
                pendingLabel="Rotating…"
              >
                <Icon icon={RefreshIcon} size={16} />
                Yes, replace the link
              </SubmitButton>
            ) : null}

            {confirming === "end" ? (
              <SubmitButton
                name="intent"
                value="end"
                variant="destructive"
                pendingLabel="Ending…"
              >
                Yes, end this offer
              </SubmitButton>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <Button
            type="button"
            variant={publishing ? "ghost" : "reward"}
            onClick={() =>
              setConfirming(confirming === "publish" ? null : "publish")
            }
          >
            {publishing ? "Not yet" : "Publish this offer"}
          </Button>
        ) : null}

        {!isDraft ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setConfirming(confirming === "rotate" ? null : "rotate")
            }
          >
            {confirming === "rotate" ? "Keep the link" : "Rotate the link"}
          </Button>
        ) : null}

        {!isDraft ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirming(confirming === "end" ? null : "end")}
          >
            {confirming === "end" ? "Keep it running" : "End this offer"}
          </Button>
        ) : null}
      </div>

      {publishing ? (
        <StatusBanner tone="warning" title="Publishing cannot be undone">
          The benefit, the dates, the ID rule and the terms are fixed from the
          moment you publish, and nothing can edit them afterwards. You can
          still pause new claims, rotate the link or end the offer.
        </StatusBanner>
      ) : null}

      {confirming === "rotate" ? (
        <StatusBanner tone="warning" title="The old link stops working at once">
          Rotating issues a new link and invalidates the current one
          immediately. Every poster, card and message carrying the old link
          stops working, so reprint them before you rotate. Offers already
          claimed are not affected.
        </StatusBanner>
      ) : null}

      {confirming === "end" ? (
        <StatusBanner tone="error" title="Ending an offer cannot be undone">
          Ending stops all new claims and switches the link off for good. Passes
          already issued keep their own terms and stay redeemable until their
          end date — ending the offer does not cancel them.
        </StatusBanner>
      ) : null}
    </div>
  )
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

function CampaignMetrics({ campaign }: { campaign: MerchantOfferCampaign }) {
  const { metrics } = campaign

  return (
    <section className="grid gap-3" aria-label="Offer results">
      <Eyebrow>Results so far</Eyebrow>
      {/* Five tiles never squeeze into two phone columns: below lg they run as
          a snap-scroll rail at a steady 10rem, from lg they take the grid. */}
      <div className="flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
        <MetricTile
          className="min-w-[10rem] snap-start lg:min-w-0"
          label="Link opened"
          value={metrics.linkOpens.toLocaleString("en-GB")}
          helper="Times the offer page loaded while it was open to claims."
        />
        <MetricTile
          className="min-w-[10rem] snap-start lg:min-w-0"
          label="Claimed"
          value={metrics.claims.toLocaleString("en-GB")}
          helper="Customers who joined through this offer."
        />
        <MetricTile
          className="min-w-[10rem] snap-start lg:min-w-0"
          label="Welcome stamps"
          value={metrics.bonusStampsIssued.toLocaleString("en-GB")}
          helper="Stamps granted across those claims."
        />
        <MetricTile
          className="min-w-[10rem] snap-start lg:min-w-0"
          label="Passes in date"
          value={metrics.activePasses.toLocaleString("en-GB")}
          helper="Discount passes still inside their window."
        />
        <MetricTile
          className="min-w-[10rem] snap-start lg:min-w-0"
          label="Pass redemptions"
          value={metrics.passRedemptions.toLocaleString("en-GB")}
          helper="Times staff have honoured a pass."
        />
      </div>
      {/* The caveat stays on screen: the tiles must never be read as people
          through the door. Only the elaboration folds away. */}
      <p className="text-xs leading-5 text-muted-foreground">
        Claims, stamps and redemptions are exact. Link opens are not — they
        count page loads, not people.
      </p>
      <Disclosure label="How these are counted">
        <p className="text-xs leading-5 text-muted-foreground">
          A refresh, a second device and an automated preview each add one to
          link opens, and we cannot tell them apart without tracking whoever
          opened it. Nothing is counted while your offer is paused, before it
          opens or after it ends. Read it as interest, not as visitors.
        </p>
      </Disclosure>
    </section>
  )
}

// ─── Post-action notice ───────────────────────────────────────────────────────

const NOTICE_COPY: Record<
  OfferNoticeFlag,
  { tone: "success" | "info" | "warning"; title: string; body: string }
> = {
  published: {
    tone: "success",
    title: "Your offer is live",
    body: "Print the campaign QR and put it where customers will see it. Only people who are not yet members can claim.",
  },
  scheduled: {
    tone: "success",
    title: "Your offer is scheduled",
    body: "It opens on its start date and starts accepting claims on its own. You can print the QR now.",
  },
  paused: {
    tone: "info",
    title: "New claims paused",
    body: "Nobody new can claim. Passes already issued keep working until their own end date.",
  },
  resumed: {
    tone: "success",
    title: "Accepting claims again",
    body: "Your offer is back open to new members.",
  },
  ended: {
    tone: "info",
    title: "Offer ended",
    body: "The link has been switched off. Passes already issued stay redeemable until their end date.",
  },
  rotated: {
    tone: "warning",
    title: "New link issued",
    body: "The previous link stopped working immediately. Reprint anything that carried it.",
  },
}

const ERROR_COPY: Record<OfferNoticeCode, string> = {
  sign_in: "Sign in to manage your offers.",
  link: "The campaign link couldn't be prepared. Try again, and contact support if it keeps happening.",
  already_ended: "That offer has already ended.",
  not_published: "Publish the offer before you change it.",
  window_passed: "That offer's dates have passed, so it can't be restarted.",
  not_found: "That offer could not be found.",
  not_acknowledged:
    "Confirm you understand the terms are locked before you publish. Nothing was published.",
  generic: "That didn't work. Try again.",
}

/**
 * Renders the result of the last lifecycle action. The query string carries a
 * code from a closed set, never a sentence, so an edited URL can only ever
 * select copy this component already owns — or, failing that, the generic line.
 */
export function OfferActionNotice({
  notice,
  error,
}: {
  readonly notice?: string | null
  readonly error?: string | null
}) {
  if (error) {
    const copy = isNoticeCode(error) ? ERROR_COPY[error] : ERROR_COPY.generic
    return (
      <StatusBanner tone="error" title="That didn't work.">
        {copy}
      </StatusBanner>
    )
  }

  if (!notice || !isNoticeFlag(notice)) return null

  const copy = NOTICE_COPY[notice]
  return (
    <StatusBanner tone={copy.tone} title={copy.title}>
      {copy.body}
    </StatusBanner>
  )
}

function isNoticeCode(value: string): value is OfferNoticeCode {
  return Object.prototype.hasOwnProperty.call(ERROR_COPY, value)
}

function isNoticeFlag(value: string): value is OfferNoticeFlag {
  return Object.prototype.hasOwnProperty.call(NOTICE_COPY, value)
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

function headline(campaign: MerchantOfferCampaign): string {
  if (campaign.bonusStampCount && campaign.discountPercent) {
    return `${campaign.bonusStampCount} welcome ${campaign.bonusStampCount === 1 ? "stamp" : "stamps"} and ${campaign.discountPercent}% off`
  }
  if (campaign.discountPercent) {
    return `${campaign.discountPercent}% off the whole bill`
  }
  if (campaign.bonusStampCount) {
    return `${campaign.bonusStampCount} welcome ${campaign.bonusStampCount === 1 ? "stamp" : "stamps"}`
  }
  return "Your offer"
}

function summary(campaign: MerchantOfferCampaign): string {
  const window = `${formatOfferDate(campaign.startsOn)} to ${formatOfferDate(campaign.endsOn)}`

  if (campaign.status === "scheduled") {
    return `Waiting to open on ${formatOfferDate(campaign.startsOn)}, then running until ${formatOfferDate(campaign.endsOn)}.`
  }
  if (campaign.status === "paused") {
    return `Paused. The offer's dates are ${window}.`
  }
  if (campaign.status === "draft") {
    return `Not published yet. Once you publish, the offer runs ${window}.`
  }
  return `Running ${window}. For new members only.`
}
