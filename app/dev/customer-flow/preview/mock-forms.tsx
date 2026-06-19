import type { ReactNode } from "react"
import Link from "next/link"

import { Eyebrow, MonoTag, SectionHeader, VenueMark } from "@/components/brand"
import {
  CustomerLegalConsentLinks,
  CustomerVenueTermsSheet,
} from "@/components/customer/legal-sheet"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  JOIN_PHONE_BACK_LABEL,
  JOIN_PHONE_CODE_HINT,
  JOIN_WELCOME_HOW_IT_WORKS,
  joinWelcomeHref,
} from "@/lib/customer/experience/copy"
import {
  CUSTOMER_FLOW_MOCK,
  formatMockPence,
} from "@/lib/dev/customer-flow-preview"

// Mirrors the shipped customer-flow inputs but intentionally drops the
// transition/focus utilities — every field in this dev harness is readOnly,
// so there is no focus state to style. Keeps the load-bearing
// `text-base … md:text-sm` (iOS no-zoom) sizing.
const previewInputClass =
  "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-base outline-none md:text-sm"

type PreviewIdentityVariant = "empty" | "phone-filled" | "otp-sent"

export function PreviewIdentityForm({
  variant,
}: {
  readonly variant: PreviewIdentityVariant
}) {
  const phoneOtpSent = variant === "otp-sent"
  const phoneValue = variant === "empty" ? "" : CUSTOMER_FLOW_MOCK.phone

  if (phoneOtpSent) {
    return (
      <div className="grid gap-4">
        <form className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="otp" className="eyebrow">
              Text code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              defaultValue="424242"
              readOnly
              className={`${previewInputClass} font-mono`}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Enter the verification code sent to your phone.
            </p>
          </div>
          <Button type="button" size="lg" className="w-full">
            Save my card
          </Button>
        </form>
        <div className="surface-card grid gap-2 p-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow text-muted-foreground">Sent to</span>
            <Button type="button" variant="link" size="xs" className="text-xs">
              Resend code
            </Button>
          </div>
          <p className="text-sm font-bold tabular-nums">{phoneValue}</p>
          <Link
            href={`/m/${CUSTOMER_FLOW_MOCK.merchantSlug}/join?qr=${CUSTOMER_FLOW_MOCK.qrId}&step=phone`}
            className="w-fit text-xs font-bold underline underline-offset-4"
          >
            Use a different number
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-4">
        <div className="grid justify-items-center gap-2 pb-1 text-center">
          <VenueMark name="Nabaperks" caption="Save card" />
          <Eyebrow>One text, no password</Eyebrow>
          <p className="max-w-[28ch] text-sm leading-6 text-muted-foreground">
            Keep this stamp card safe with your UK mobile number.
          </p>
        </div>
        <div className="grid gap-2">
          <label htmlFor="contact" className="eyebrow">
            Phone number
          </label>
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07400 123456"
            defaultValue={phoneValue}
            readOnly
            className={previewInputClass}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {JOIN_PHONE_CODE_HINT}
          </p>
        </div>
        <Button type="button" size="lg" className="w-full">
          Text me the code
        </Button>
      </form>
      <Link
        href={joinWelcomeHref(
          CUSTOMER_FLOW_MOCK.merchantSlug,
          CUSTOMER_FLOW_MOCK.qrId
        )}
        className="text-center text-xs font-bold underline underline-offset-4"
      >
        {JOIN_PHONE_BACK_LABEL}
      </Link>
    </div>
  )
}

export function PreviewJoinTermsForm() {
  return (
    <form className="grid gap-4">
      {/* One flat wrapper, two inline checkboxes — mirrors the shipped
          CustomerJoinForm so the dev playbook stays truthful. */}
      <fieldset className="surface-card grid gap-3 p-4 text-sm">
        <label className="flex items-start gap-3">
          <input
            name="loyaltyTerms"
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            defaultChecked
            readOnly
          />
          <span className="grid gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Eyebrow>Loyalty terms</Eyebrow>
              <MonoTag tone="accent">Required</MonoTag>
            </span>
            <span className="leading-6 text-muted-foreground">
              I agree to keep this loyalty card and that stamps and rewards
              follow the{" "}
              <CustomerLegalConsentLinks
                venueTerms={{
                  merchantName: CUSTOMER_FLOW_MOCK.merchantName,
                  stampsRequired: CUSTOMER_FLOW_MOCK.stampsRequired,
                  rewardTerms: CUSTOMER_FLOW_MOCK.rewardTerms,
                }}
              />{" "}
              terms.
            </span>
          </span>
        </label>
        <hr className="w-rule" />
        <label className="flex items-start gap-3">
          <input
            name="marketingOptIn"
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            readOnly
          />
          <span className="grid gap-1">
            <Eyebrow>Marketing updates</Eyebrow>
            <span className="leading-6 text-muted-foreground">
              Send me occasional offers from this business. Optional.
            </span>
          </span>
        </label>
      </fieldset>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Finish here and your first stamp lands straight away — no second scan
        needed.
      </p>
      <Button type="button">Save my card</Button>
    </form>
  )
}

export function PreviewStampButton({ href }: { readonly href: string }) {
  return (
    <div className="grid gap-4">
      <Button asChild size="lg" className="w-full">
        <Link href={href}>Add today&apos;s stamp</Link>
      </Button>
    </div>
  )
}

export function PreviewRewardQrButton() {
  return (
    <div className="grid gap-4">
      <Button type="button" size="lg" variant="reward" className="w-full">
        Open reward QR
      </Button>
    </div>
  )
}

export function PreviewProfileGate() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-left">
        <Eyebrow>Full name</Eyebrow>
        <input
          className={previewInputClass}
          defaultValue="Sam Taylor"
          readOnly
        />
      </div>
      <div className="grid gap-2 text-left">
        <Eyebrow>Date of birth</Eyebrow>
        <input
          className={previewInputClass}
          defaultValue="1990-01-01"
          readOnly
        />
      </div>
      <div className="grid gap-2 text-left">
        <Eyebrow>Email (optional)</Eyebrow>
        <input
          className={previewInputClass}
          placeholder="you@example.com"
          readOnly
        />
        <p className="text-xs leading-5 text-muted-foreground">
          We&apos;ll send a code to confirm it.
        </p>
      </div>
      <Button type="button" size="lg" className="w-full">
        Save my details
      </Button>
    </div>
  )
}

export function PreviewJoinHeroNote() {
  return (
    <>
      {/* Borderless "how it works" list — mirrors the shipped welcome screen. */}
      <section className="grid gap-2 text-left">
        <p className="eyebrow text-muted-foreground">How it works</p>
        <ol className="grid gap-2">
          {JOIN_WELCOME_HOW_IT_WORKS.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-5 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-[0.7rem] leading-none font-extrabold text-primary-foreground"
              >
                {index + 1}
              </span>
              <span className="text-sm leading-snug font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <CustomerVenueTermsSheet
        venueTerms={{
          merchantName: CUSTOMER_FLOW_MOCK.merchantName,
          stampsRequired: CUSTOMER_FLOW_MOCK.stampsRequired,
          rewardTerms: CUSTOMER_FLOW_MOCK.rewardTerms,
        }}
        triggerLabel="View full venue terms"
        triggerClassName="inline-flex w-fit text-xs font-bold underline underline-offset-4"
      />
    </>
  )
}

export function PreviewMinSpendNote() {
  return (
    <> Minimum spend {formatMockPence(CUSTOMER_FLOW_MOCK.minSpendPence)}.</>
  )
}

// --- Profile harness mocks (mirror /home/profile) ---------------------------

function PreviewDetailRow({
  label,
  value,
  tag,
}: {
  label: string
  value: string
  tag?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-bold break-all">
        <span>{value}</span>
        {tag}
      </dd>
    </div>
  )
}

/** View mode: read-only summary with a single "Edit details" action. */
export function PreviewProfileAboutYouView() {
  return (
    <section className="surface-card grid gap-4 p-5 text-left">
      <SectionHeader eyebrow="About you" title="Your contact details" />
      <dl className="grid gap-3">
        <PreviewDetailRow
          label="Phone"
          value={CUSTOMER_FLOW_MOCK.phone}
          tag={<MonoTag tone="leaf">Verified</MonoTag>}
        />
        <PreviewDetailRow label="Full name" value="Sam Taylor" />
        <PreviewDetailRow label="Date of birth" value="1 Jan 1990" />
        <PreviewDetailRow
          label="Email"
          value="sam@example.com"
          tag={<MonoTag tone="leaf">Verified</MonoTag>}
        />
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">
        To change your phone number, scan a venue QR with your new phone.
      </p>
      <Button type="button" variant="secondary" className="w-full">
        Edit details
      </Button>
    </section>
  )
}

/** Edit mode: the form with empty name/DOB (incomplete profile). */
export function PreviewProfileAboutYouEdit() {
  return (
    <section className="surface-card grid gap-4 p-5 text-left">
      <SectionHeader eyebrow="About you" title="Your contact details" />
      <form className="grid gap-4">
        <div className="grid gap-2">
          <label className="eyebrow">Full name</label>
          <input
            className={previewInputClass}
            placeholder="Sam Taylor"
            readOnly
          />
        </div>
        <div className="grid gap-2">
          <label className="eyebrow">Date of birth</label>
          <input className={previewInputClass} type="date" readOnly />
        </div>
        <div className="grid gap-2">
          <label className="eyebrow">Email (optional)</label>
          <input
            className={previewInputClass}
            placeholder="you@example.com"
            readOnly
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Add one to get reward updates. We&apos;ll send a code to confirm it.
          </p>
        </div>
        <div className="grid gap-2">
          <Button type="button" size="lg" className="w-full">
            Save changes
          </Button>
          <Button type="button" variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}

/** Verify mode: the email-confirm step takes over the card. */
export function PreviewProfileEmailVerify() {
  return (
    <section className="surface-card grid gap-4 p-5 text-left">
      <SectionHeader eyebrow="About you" title="Your contact details" />
      <div className="grid gap-3">
        <StatusBanner title="Confirm your email" tone="neutral">
          Enter the code we sent to sam@example.com to verify it.
        </StatusBanner>
        <form className="grid gap-3">
          <div className="grid gap-2">
            <label className="eyebrow">Email code</label>
            <input
              className={`${previewInputClass} font-mono`}
              inputMode="numeric"
              defaultValue="424242"
              readOnly
            />
          </div>
          <Button type="button" size="lg" className="w-full">
            Confirm email
          </Button>
        </form>
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="link" size="xs" className="text-xs">
            Email me a new code
          </Button>
          <Button type="button" variant="link" size="xs" className="text-xs">
            Continue without email
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Editable global marketing toggles (Email on, SMS/WhatsApp off). */
export function PreviewProfileMarketing() {
  const rows = [
    {
      label: "Email",
      helper: "Reward updates and offers by email.",
      checked: true,
    },
    {
      label: "SMS",
      helper: "Occasional offers by text message.",
      checked: false,
    },
    {
      label: "WhatsApp",
      helper: "Updates and offers on WhatsApp.",
      checked: false,
    },
  ]

  return (
    <section className="surface-card grid gap-4 p-5 text-left">
      <SectionHeader eyebrow="Marketing" title="Updates from your venues" />
      <p className="text-sm leading-6 text-muted-foreground">
        Optional. Turning these off won&apos;t affect stamps or rewards.
      </p>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-start justify-between gap-4"
          >
            <div className="grid gap-1">
              <Eyebrow>{row.label}</Eyebrow>
              <p className="text-sm leading-6 text-muted-foreground">
                {row.helper}
              </p>
            </div>
            <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
              <span className="sr-only">Receive {row.label} updates</span>
              <input
                type="checkbox"
                defaultChecked={row.checked}
                readOnly
                className="size-5 shrink-0 accent-primary"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Quiet mono receipt line beneath the cards. */
export function PreviewProfileMeta() {
  return (
    <p className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
      Member since June 2026 · 2 venues
    </p>
  )
}
