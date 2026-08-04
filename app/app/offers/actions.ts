"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentMerchant, getCurrentUser } from "@/lib/auth/session"
import { ukTodayIso } from "@/lib/customer/uk-calendar"
import {
  OFFER_CAMPAIGN_DRAFT_SUCCESS,
  readOfferCampaignFields,
  validateOfferCampaignFields,
  type OfferCampaignFormFields,
} from "@/lib/merchant/offer-campaign-fields"
import {
  OFFERS_HOME_PATH,
  offerReturnHref,
  resolveOfferReturnBase,
} from "@/lib/merchant/offer-nav"
import type { OfferCampaignDraftErrors } from "@/lib/offers/campaign-core"
import { firstRpcRecord, rpcStringField } from "@/lib/offers/rpc-rows"
import { offerClaimTokenSet } from "@/lib/offers/tokens"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

/**
 * The single mutation entry point for the merchant Offers surface. One
 * dispatcher drives one `useActionState` in the creator, and the same dispatcher
 * serves the management panel's lifecycle buttons — so there is exactly one
 * place where a merchant session is proved and a claim link is derived.
 *
 * Two response shapes on purpose:
 *   * `draft` returns state, because the creator has to show field-level errors
 *     next to the boxes the merchant just typed in.
 *   * `publish`, `pause`, `resume`, `end` and `rotate` redirect, because they
 *     change what the whole screen says. `returnTo` sends the merchant back to
 *     the screen they acted from, resolved through the allowlist in
 *     lib/merchant/offer-nav.ts so the posted value is never reflected.
 *
 * The merchant session is deliberately re-proved on every call rather than
 * trusted from the rendering page: a server action is its own HTTP entry point.
 */

export type OfferCreatorStep = "benefits" | "rules" | "review"

/**
 * What a lifecycle redirect is allowed to say. Both vocabularies are closed
 * sets, and the copy for each lives with the component that renders it — so a
 * hand-edited `?error=` or `?notice=` can never put a sentence of someone
 * else's choosing inside the merchant console.
 */
export type OfferNoticeCode =
  | "sign_in"
  | "link"
  | "already_ended"
  | "not_published"
  | "window_passed"
  | "not_found"
  | "not_acknowledged"
  | "generic"

export type OfferNoticeFlag =
  "published" | "scheduled" | "paused" | "resumed" | "ended" | "rotated"

export type OfferCampaignState = {
  step?: OfferCreatorStep
  fields?: OfferCampaignFormFields
  errors?: OfferCampaignDraftErrors & { form?: string }
  /** Set once a draft exists, so the review step can publish it. */
  campaignId?: string
  message?: string
}

/**
 * What every offer route needs before it renders: the card length that bounds
 * the bonus-stamp field, and the reward it leads to. Takes no arguments and
 * reports only on the caller's own venue.
 */
export type OfferDeskContext = {
  /** 0 when the venue has no active loyalty card yet. */
  stampsRequired: number
  rewardName: string | null
}

const SIGN_IN_ERROR = "Sign in to manage your offers."
const LINK_ERROR =
  "The campaign link couldn't be prepared. Try again, and contact support if it keeps happening."

export async function loadOfferDeskContext(): Promise<OfferDeskContext> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    return { stampsRequired: 0, rewardName: null }
  }

  const supabase = await createSupabaseServerClient()
  const card = await supabase
    .from("loyalty_cards")
    .select("stamps_required, reward_name")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const stampsRequired = card.data?.stamps_required
  const rewardName = card.data?.reward_name

  return {
    stampsRequired: typeof stampsRequired === "number" ? stampsRequired : 0,
    rewardName: typeof rewardName === "string" ? rewardName : null,
  }
}

export async function offerCampaignFormAction(
  previousState: OfferCampaignState,
  formData: FormData
): Promise<OfferCampaignState> {
  const intent = textValue(formData, "intent")
  const gate = await requireOfferDesk()

  if (!gate.ok) {
    if (intent === "draft") {
      return { ...previousState, errors: { form: gate.error } }
    }
    redirect(
      offerReturnHref(
        resolveOfferReturnBase(formData.get("returnTo")),
        `error=${gate.code}`
      )
    )
  }

  if (intent === "publish") return publishCampaign(gate, formData)
  if (intent === "pause") return transitionCampaign(gate, formData, "pause")
  if (intent === "resume") return transitionCampaign(gate, formData, "resume")
  if (intent === "end") return transitionCampaign(gate, formData, "end")
  if (intent === "rotate") return rotateCampaignLink(gate, formData)
  return draftCampaign(gate, formData)
}

// ─── Gate ─────────────────────────────────────────────────────────────────────

type OfferDeskGate =
  | { ok: true; merchantId: string; actorUserId: string | null }
  | { ok: false; error: string; code: OfferNoticeCode }

/**
 * Proves the caller owns a merchant venue before any campaign row is touched.
 * A server action is its own HTTP entry point, so the session is re-proved here
 * rather than trusted from the page that rendered the form.
 */
async function requireOfferDesk(): Promise<OfferDeskGate> {
  const [merchant, user] = await Promise.all([
    getCurrentMerchant(),
    getCurrentUser(),
  ])
  if (!merchant) return { ok: false, error: SIGN_IN_ERROR, code: "sign_in" }

  return { ok: true, merchantId: merchant.id, actorUserId: user?.id ?? null }
}

// ─── Draft ────────────────────────────────────────────────────────────────────

async function draftCampaign(
  gate: Extract<OfferDeskGate, { ok: true }>,
  formData: FormData
): Promise<OfferCampaignState> {
  const fields = readOfferCampaignFields(formData)
  const context = await loadOfferDeskContext()

  if (context.stampsRequired < 1) {
    return {
      step: "rules",
      fields,
      errors: {
        form: "Build your loyalty card before you create an offer.",
      },
    }
  }

  const validation = validateOfferCampaignFields(fields, {
    stampsRequired: context.stampsRequired,
    today: ukTodayIso(),
  })
  if (!validation.ok) {
    return { step: "rules", fields, errors: validation.errors }
  }

  const draft = validation.draft
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_offer_campaign_draft", {
    p_merchant_id: gate.merchantId,
    p_created_by: gate.actorUserId,
    p_name: draft.name,
    p_customer_description: draft.customerDescription,
    p_bonus_stamp_count: draft.bonusStampCount,
    p_discount_percent: draft.discountPercent,
    p_starts_on: draft.startsOn,
    p_ends_on: draft.endsOn,
    p_requires_id_check: draft.requiresIdCheck,
    p_extra_terms: draft.extraTerms,
    p_claim_token_hash: null,
    p_claim_token_ciphertext: null,
  })

  if (error) {
    return { step: "rules", fields, errors: { form: draftErrorCopy(error) } }
  }

  const campaignId = rpcStringField(firstRpcRecord(data), "campaign_id")
  if (!campaignId) {
    return { step: "rules", fields, errors: { form: draftErrorCopy(null) } }
  }

  // The token is derived from the campaign id, so the link can only be
  // installed once the row exists. Generation 1 is an install, not a rotation.
  if (!(await installClaimLink(gate, campaignId, 1))) {
    return { step: "rules", fields, errors: { form: LINK_ERROR } }
  }

  revalidatePath(OFFERS_HOME_PATH)
  return {
    step: "review",
    fields,
    campaignId,
    message: OFFER_CAMPAIGN_DRAFT_SUCCESS,
  }
}

// ─── Publish ──────────────────────────────────────────────────────────────────

/**
 * Every publish submission must carry this exact value in an `acknowledgement`
 * field. Publishing freezes the benefit, the dates, the ID rule and the terms
 * for the life of the campaign — the database refuses to rewrite them
 * afterwards — so the confirmation the screen presents as mandatory has to be
 * mandatory here too. An HTML `required` checkbox is a courtesy to the person
 * using a browser; it is not a control, because nothing stops a submission that
 * never rendered it. The value is a literal rather than the browser's default
 * "on" so the field cannot be satisfied by an unrelated checkbox of the same
 * name, and so a grep finds every surface that claims to have asked.
 */
const PUBLISH_ACKNOWLEDGEMENT = "terms-locked"

async function publishCampaign(
  gate: Extract<OfferDeskGate, { ok: true }>,
  formData: FormData
): Promise<never> {
  const campaignId = textValue(formData, "campaignId")

  if (textValue(formData, "acknowledgement") !== PUBLISH_ACKNOWLEDGEMENT) {
    redirect(
      offerReturnHref(
        resolveOfferReturnBase(formData.get("returnTo")),
        "error=not_acknowledged"
      )
    )
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("publish_offer_campaign", {
    p_merchant_id: gate.merchantId,
    p_campaign_id: campaignId,
    p_actor_user_id: gate.actorUserId,
  })

  if (error) {
    redirect(offerReturnHref(OFFERS_HOME_PATH, `error=${lifecycleCode(error)}`))
  }

  revalidatePath(OFFERS_HOME_PATH)
  redirect(
    offerReturnHref(
      OFFERS_HOME_PATH,
      `notice=${data === "scheduled" ? "scheduled" : "published"}`
    )
  )
}

// ─── Pause / resume / end ─────────────────────────────────────────────────────

const TRANSITIONS = {
  pause: { rpc: "pause_offer_campaign", notice: "notice=paused" },
  resume: { rpc: "resume_offer_campaign", notice: "notice=resumed" },
  end: { rpc: "end_offer_campaign", notice: "notice=ended" },
} as const

async function transitionCampaign(
  gate: Extract<OfferDeskGate, { ok: true }>,
  formData: FormData,
  intent: keyof typeof TRANSITIONS
): Promise<never> {
  const base = resolveOfferReturnBase(formData.get("returnTo"))
  const campaignId = textValue(formData, "campaignId")
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc(TRANSITIONS[intent].rpc, {
    p_merchant_id: gate.merchantId,
    p_campaign_id: campaignId,
    p_actor_user_id: gate.actorUserId,
  })

  if (error) {
    redirect(offerReturnHref(base, `error=${lifecycleCode(error)}`))
  }

  revalidatePath(OFFERS_HOME_PATH)
  // Ending frees the venue's single slot and scrubs the link, so the campaign
  // QR screen no longer has anything to show — always land back on the hub.
  redirect(
    intent === "end"
      ? offerReturnHref(OFFERS_HOME_PATH, TRANSITIONS[intent].notice)
      : offerReturnHref(base, TRANSITIONS[intent].notice)
  )
}

// ─── Rotate the confidential link ─────────────────────────────────────────────

async function rotateCampaignLink(
  gate: Extract<OfferDeskGate, { ok: true }>,
  formData: FormData
): Promise<never> {
  const base = resolveOfferReturnBase(formData.get("returnTo"))
  const campaignId = textValue(formData, "campaignId")
  const supabase = createSupabaseServiceRoleClient()

  const { data } = await supabase
    .from("offer_campaigns")
    .select("token_generation")
    .eq("id", campaignId)
    .eq("merchant_id", gate.merchantId)
    .maybeSingle()

  const current = data?.token_generation
  if (typeof current !== "number" || current < 1) {
    redirect(offerReturnHref(base, "error=link"))
  }

  if (!(await installClaimLink(gate, campaignId, current + 1))) {
    redirect(offerReturnHref(base, "error=link"))
  }

  revalidatePath(OFFERS_HOME_PATH)
  redirect(offerReturnHref(base, "notice=rotated"))
}

/**
 * Derive one generation's token and hand the database its hash plus an
 * encrypted copy. The RPC settles the generation itself under a row lock and
 * returns it; a concurrent second rotate can therefore land on a generation we
 * did not derive for. That is safe rather than broken: the hash and the
 * ciphertext are written together, so `resolveOfferClaimLink` still returns a
 * link whose own hash matches the stored one — it simply comes from the
 * ciphertext instead of re-derivation.
 */
async function installClaimLink(
  gate: Extract<OfferDeskGate, { ok: true }>,
  campaignId: string,
  generation: number
): Promise<boolean> {
  let tokenSet
  try {
    tokenSet = offerClaimTokenSet(campaignId, generation)
  } catch {
    return false
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("rotate_offer_campaign_token", {
    p_merchant_id: gate.merchantId,
    p_campaign_id: campaignId,
    p_claim_token_hash: tokenSet.claimTokenHash,
    p_claim_token_ciphertext: tokenSet.claimTokenCiphertext,
    p_actor_user_id: gate.actorUserId,
  })

  return !error
}

// ─── Error copy ───────────────────────────────────────────────────────────────

/**
 * Postgres detail never reaches a merchant. Each branch matches a message this
 * feature's own RPCs raise; anything unrecognised falls back to a calm retry.
 */
function draftErrorCopy(error: { message: string } | null): string {
  const message = error?.message ?? ""
  if (/already has an offer running/i.test(message)) {
    return "You already have an offer running. End it before you create another."
  }
  if (/no active loyalty card/i.test(message)) {
    return "Build your loyalty card before you create an offer."
  }
  if (/fewer than the/i.test(message)) {
    return "Bonus stamps must stay below the number a customer needs for a reward."
  }
  if (/window has already passed/i.test(message)) {
    return "Choose an end date that has not already passed."
  }
  return "We couldn't save that offer. Check the details and try again."
}

/**
 * Lifecycle failures travel back in the query string, so they travel as a code
 * from a closed set and never as free text. Anything reflected out of a URL is
 * attacker-controllable, and the merchant console is exactly where a planted
 * sentence would be believed; the reader maps the code to copy it owns.
 */
function lifecycleCode(error: { message: string }): OfferNoticeCode {
  const message = error.message
  if (/has ended/i.test(message)) return "already_ended"
  if (/not been published/i.test(message)) return "not_published"
  if (/window has already passed/i.test(message)) return "window_passed"
  if (/no link yet/i.test(message)) return "link"
  if (/not found/i.test(message)) return "not_found"
  return "generic"
}

// ─── Boundary narrowing ───────────────────────────────────────────────────────

function textValue(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
