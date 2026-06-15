import Link from "next/link"

import { Eyebrow, MonoTag, VenueMark } from "@/components/brand"
import {
  CustomerLegalConsentLinks,
  CustomerVenueTermsSheet,
} from "@/components/customer/legal-sheet"
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
              className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 font-mono text-sm outline-none"
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
            className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none"
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

export function PreviewStampButton() {
  return (
    <div className="grid gap-4">
      <Button type="button" size="lg" className="w-full">
        Add today&apos;s stamp
      </Button>
    </div>
  )
}

export function PreviewRedeemButton() {
  return (
    <div className="grid gap-4">
      <Button type="button" size="lg" variant="reward" className="w-full">
        Show reward QR
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
