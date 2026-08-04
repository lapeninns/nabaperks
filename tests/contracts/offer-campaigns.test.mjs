import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for the Merchant Offers and Campaign QR schema.
 *
 * Every pin below guards a property that no runtime check can restore once it
 * has been lost. A table that forgets `force row level security` reads
 * correctly in every test that runs as service_role. A claim token hash without
 * a unique index accepts two campaigns behind one link. A bonus stamp written
 * with a business date collides on the one-earned-stamp-per-day index and
 * re-arms the QR and geofence requirements. A redemption whose scan token can
 * be deleted loses the only proof that the code was single use. And a bill
 * amount or an identity document field, once a column exists for it, is data
 * this product has promised never to hold.
 *
 * These are deliberately source assertions rather than database ones: the
 * database tier proves the behaviour of the schema that is deployed, while this
 * tier fails the moment the migration text stops saying so — including on a
 * machine with no Supabase running.
 */

const projectRoot = process.cwd()

/** The eight migrations that make up the feature, in application order. */
const OFFER_MIGRATIONS = {
  schema: "20260803100000_offer_campaign_schema.sql",
  lifecycle: "20260803100100_offer_campaign_lifecycle_rpcs.sql",
  claim: "20260803100200_offer_campaign_claim.sql",
  passRedeem: "20260803100300_offer_pass_scan_and_redeem.sql",
  referral: "20260803100400_referral_exclude_offer_stamp_qualification.sql",
  retention: "20260803100500_offer_campaign_retention.sql",
  identity: "20260803100600_offer_campaign_identity.sql",
  alwaysOn: "20260804120000_offer_campaigns_always_on.sql",
}

/** The five tables the feature owns. All are customer or bearer material. */
const OFFER_TABLES = [
  "offer_campaigns",
  "offer_campaign_claims",
  "offer_discount_entitlements",
  "offer_pass_scan_tokens",
  "offer_redemptions",
]

/**
 * Every file the feature owns outside the migrations. The no-bill-amount and
 * no-identity-data pins sweep all of them, so a new surface that reintroduced
 * either would have to be added here to escape the check — and adding it is the
 * review moment.
 */
const OFFER_SOURCE_FILES = [
  "app/app/offers/page.tsx",
  "app/app/offers/actions.ts",
  "app/app/offers/new/page.tsx",
  "app/app/offers/[campaignId]/qr/page.tsx",
  "app/app/offers/[campaignId]/qr.png/route.ts",
  "app/app/offers/scan/[passToken]/page.tsx",
  "app/app/offers/scan/[passToken]/actions.ts",
  "app/offer/[token]/page.tsx",
  "app/offer/[token]/actions.ts",
  "app/p/[token]/page.tsx",
  "app/pass/[entitlementId]/page.tsx",
  "app/pass/[entitlementId]/qr.png/route.ts",
  "lib/offers/campaign-core.ts",
  "lib/offers/claim-context.ts",
  "lib/offers/constants.ts",
  "lib/offers/offer-cookie.ts",
  "lib/offers/pass-qr.ts",
  "lib/offers/pass-tokens.ts",
  "lib/offers/redeem-core.ts",
  "lib/offers/rpc-rows.ts",
  "lib/offers/tokens.ts",
  "lib/customer/offer-pass.ts",
  "lib/customer/offer-pass-view.ts",
  "lib/merchant/offer-campaign-fields.ts",
  "lib/merchant/offer-campaigns.ts",
  "lib/merchant/offer-nav.ts",
  "lib/merchant/offer-pass-redemption.ts",
  "components/loyalty/offer-pass.tsx",
  "components/customer/offer-pass-qr.tsx",
  "components/merchant/offer-campaign-form.tsx",
  "components/merchant/offer-campaign-panel.tsx",
  "components/merchant/offer-pass-redeem-form.tsx",
  "components/merchant/offers/offer-benefit-preview.tsx",
  "components/merchant/offers/offer-rules-summary.tsx",
]

/**
 * Names that must never appear anywhere in the feature. `min_spend_pence` was
 * deliberately deleted from this codebase in 20260624120000 and 20260707091000;
 * reintroducing an equivalent under a new name is the regression this guards.
 * Photo ID is attested as a boolean and nothing about the document is kept, so
 * a document number, an image or a date of birth has no home here either.
 */
const FORBIDDEN_DATA_NAMES = [
  "bill_amount",
  "billAmount",
  "bill_total",
  "billTotal",
  "min_spend",
  "minSpend",
  "spend_pence",
  "spendPence",
  "id_number",
  "idNumber",
  "id_document",
  "idDocument",
  "id_image",
  "idImage",
  "date_of_birth",
  "dateOfBirth",
]

/**
 * Copy the DB-free harness lane transcribes because the composition it belongs
 * to is private to its route. Each line must survive in both places.
 *
 * The claimable half of the landing now lives in one shared component that the
 * merchant review step renders too, so the landing is read as the route PLUS
 * that component. The counter rules (no stacking, photo identification) moved
 * onto the OfferPass face, which prints them from the one shared constant, and
 * are pinned there rather than here.
 */
const CUSTOMER_LANDING_COPY = [
  "added to your card the moment you join. There is no app to download.",
  "discount pass you can use as often as you like while the offer runs.",
  "Claim this offer",
  "This offer opens on ",
  "Scan the code again once it opens and you can claim it then.",
  "This offer is paused just now",
  "The venue has paused it for the moment. Try again later, or ask the team when it is back.",
  "This offer has finished",
  "Ask the venue whether they have a new one.",
  "This offer link is not available",
  "It may have finished, or the venue may have replaced the code. Ask the team for the current one.",
  "You are already a member here",
  "This offer is a welcome for people joining for the first time, so there is nothing to add to your card. Your card is where it always is.",
  "Open your card",
]

const STAFF_PASS_FACE_COPY = [
  "Photo ID check required. ",
  "Cannot be used with another reward or offer.",
]

const OFFERS_EMPTY_STATE_COPY = [
  "No offer running",
  "Choose what new members get, set the dates, and print the campaign QR. Nothing goes live until you publish it.",
]

/** JSX copy is line-wrapped by the formatter, so compare on flattened text. */
function flattenCopy(source) {
  return source.replace(/\s+/g, " ")
}

function migrationPath(file) {
  return join(projectRoot, "supabase", "migrations", file)
}

function readMigration(file) {
  return readFileSync(migrationPath(file), "utf8")
}

function readProjectFile(relativePath) {
  return readFileSync(join(projectRoot, relativePath), "utf8")
}

/**
 * The body of one `create table public.<name> (...)` statement. Scoping the FK
 * assertions to the table that owns them stops a matching clause on a different
 * table from satisfying the pin.
 */
function createTableBlock(source, table) {
  const start = source.indexOf(`create table public.${table} (`)
  assert.notEqual(
    start,
    -1,
    `${table} must be created with an explicit create table statement`
  )
  const end = source.indexOf("\n);", start)
  assert.notEqual(end, -1, `${table}'s create table statement must terminate`)
  return source.slice(start, end)
}

describe("contract-offer-campaigns migration source contract", () => {
  it("ships every migration the feature depends on", () => {
    for (const [label, file] of Object.entries(OFFER_MIGRATIONS)) {
      assert.equal(
        existsSync(migrationPath(file)),
        true,
        `the ${label} migration ${file} must exist`
      )
    }
  })

  it("reloads the PostgREST schema cache from every migration", () => {
    // Without this a new RPC exists in the database and is invisible to the
    // application until something else happens to reload the cache.
    for (const file of Object.values(OFFER_MIGRATIONS)) {
      assert.match(
        readMigration(file),
        /notify pgrst, 'reload schema';/,
        `${file} must end by reloading the PostgREST schema cache`
      )
    }
  })

  it("enables and forces row level security on all five offer tables", () => {
    const schema = readMigration(OFFER_MIGRATIONS.schema)

    for (const table of OFFER_TABLES) {
      assert.ok(
        schema.includes(
          `alter table public.${table} enable row level security;`
        ),
        `${table} must enable row level security`
      )
      // `force` is the half that is easy to omit and impossible to notice: the
      // table owner and every security-definer function bypass RLS without it.
      assert.ok(
        schema.includes(
          `alter table public.${table} force row level security;`
        ),
        `${table} must force row level security`
      )
    }
  })

  it("keeps one campaign behind one claim link", () => {
    const campaigns = createTableBlock(
      readMigration(OFFER_MIGRATIONS.schema),
      "offer_campaigns"
    )

    assert.match(
      campaigns,
      /claim_token_hash text unique/,
      "claim_token_hash must be unique — the landing page resolves a scan by it"
    )
    // The raw token is never stored. The ciphertext is what lets the desk keep
    // showing a working link after a secret rotation, and the two must appear
    // and disappear together.
    assert.match(campaigns, /claim_token_ciphertext text/)
    assert.match(
      campaigns,
      /check \(\(claim_token_hash is null\) = \(claim_token_ciphertext is null\)\)/
    )
  })

  it("grants bonus stamps with a NULL business date and an offer source", () => {
    // Read from the migration that holds the LIVE definition of
    // claim_offer_campaign. 20260803100200 introduced the function, but
    // 20260804120000 replaced it, and a pin on a superseded body proves nothing
    // about the function the database is running.
    const claim = readMigration(OFFER_MIGRATIONS.alwaysOn)
    const insert = claim.slice(claim.indexOf("insert into public.stamp_events"))

    assert.match(
      insert,
      /event_type, stamps_delta, earned_business_date, cycle_number, metadata/,
      "the bonus stamp insert must name earned_business_date explicitly"
    )
    // A non-null business date collides on
    // stamp_events_one_earned_per_business_day_idx for the second stamp and
    // re-arms the QR and geofence requirements for a promotional grant.
    assert.match(
      insert,
      /'earned', 1, null, v_cycle,/,
      "bonus stamps must be written with a NULL earned_business_date"
    )
    assert.match(
      insert,
      /'source', 'offer_campaign',/,
      "bonus stamps must carry metadata->>'source' = 'offer_campaign'"
    )
    assert.match(
      insert,
      /from generate_series\(1, v_bonus\) as gs\(i\)/,
      "one immutable stamp_events row per bonus stamp"
    )
  })

  it("excludes offer stamps from referral qualification", () => {
    const referral = readMigration(OFFER_MIGRATIONS.referral)

    // Without this, promotional welcome stamps silently settle referral
    // bonuses — the highest-consequence cross-subsystem coupling in the feature.
    assert.match(
      referral,
      /create or replace function public\.qualify_referral_on_stamp/
    )
    assert.match(
      referral,
      /'referral_bonus',\s*'imported',\s*'manual_adjustment',\s*'loyalty_invite',\s*'offer_campaign'/
    )
  })

  it("keeps a redemption's scan token undeletable", () => {
    const redemptions = createTableBlock(
      readMigration(OFFER_MIGRATIONS.schema),
      "offer_redemptions"
    )

    // `unique` plus `on delete restrict` is the single-use proof at the ledger
    // level: one redemption per token, and the token row cannot be swept away
    // to make room for a second.
    assert.match(
      redemptions,
      /scan_token_id uuid not null unique\s+references public\.offer_pass_scan_tokens\(id\) on delete restrict/,
      "offer_redemptions.scan_token_id must be unique and restrict deletion"
    )
    assert.match(
      redemptions,
      /constraint offer_redemptions_no_stacking_required check \(no_stacking_attested\)/
    )
  })

  it("records both attestations as booleans and nothing more", () => {
    const redemptions = createTableBlock(
      readMigration(OFFER_MIGRATIONS.schema),
      "offer_redemptions"
    )

    assert.match(redemptions, /id_check_attested boolean not null/)
    assert.match(redemptions, /no_stacking_attested boolean not null/)
  })

  it("makes the redemption ledger append-only", () => {
    const schema = readMigration(OFFER_MIGRATIONS.schema)

    assert.match(
      schema,
      /create trigger offer_redemptions_append_only[\s\S]*?before update or delete on public\.offer_redemptions/
    )
  })

  it("stores no bill amount and no identity document data anywhere", () => {
    const sources = [
      ...Object.values(OFFER_MIGRATIONS).map((file) => [
        `supabase/migrations/${file}`,
        readMigration(file),
      ]),
      ...OFFER_SOURCE_FILES.map((file) => [file, readProjectFile(file)]),
    ]

    for (const [label, source] of sources) {
      for (const name of FORBIDDEN_DATA_NAMES) {
        assert.equal(
          source.includes(name),
          false,
          `${label} must not mention ${name} — this feature holds no bill amount and no identity document data`
        )
      }
    }
  })

  it("leaves no per-venue gate behind in the database", () => {
    const alwaysOn = readMigration(OFFER_MIGRATIONS.alwaysOn)

    // Offers is an ordinary merchant feature: every venue has it, always. A
    // column left in place with nothing reading it is how a pilot list grows
    // back, so the column and its only writer are dropped rather than ignored.
    assert.match(
      alwaysOn,
      /alter table public\.merchants\s+drop column if exists offer_campaigns_enabled;/,
      "the allowlist column must be dropped, not merely left unread"
    )
    assert.match(
      alwaysOn,
      /drop function if exists public\.admin_set_merchant_offer_campaigns\(uuid, boolean\);/,
      "the admin toggle must be dropped with the column it wrote"
    )

    // The re-created bodies must not carry the test forward. Scoped to the
    // function definitions, since the teardown below them names the column by
    // design.
    const bodies = alwaysOn.slice(
      alwaysOn.indexOf("create or replace function"),
      alwaysOn.indexOf("drop function if exists")
    )
    assert.equal(
      bodies.includes("offer_campaigns_enabled"),
      false,
      "no re-created RPC may still read the allowlist column"
    )
  })

  it("bounds the merchant-authored copy in the database, not only the form", () => {
    const identity = readMigration(OFFER_MIGRATIONS.identity)

    assert.match(
      identity,
      /constraint offer_campaigns_name_length[\s\S]*?char_length\(name\) <= 60/
    )
    assert.match(
      identity,
      /constraint offer_campaigns_customer_description_length[\s\S]*?char_length\(customer_description\) <= 160/
    )
  })

  it("keeps the harness lane's transcribed copy identical to the real surfaces", () => {
    // Two page-level compositions are private to their routes, so the harness
    // reproduces them. Transcribed copy drifts silently, and a QA lane showing
    // last month's wording is worse than no lane at all — so every sentence the
    // harness copies is required to still exist in the surface it came from.
    const harness = flattenCopy(
      readProjectFile("app/dev/app-harness/offers/harness-client.tsx")
    )

    const transcriptions = [
      [
        [
          "app/offer/[token]/page.tsx",
          "components/customer/offer-claim-landing.tsx",
        ],
        CUSTOMER_LANDING_COPY,
      ],
      [["app/app/offers/scan/[passToken]/page.tsx"], STAFF_PASS_FACE_COPY],
      [["app/app/offers/page.tsx"], OFFERS_EMPTY_STATE_COPY],
    ]

    for (const [files, lines] of transcriptions) {
      const file = files.join(" + ")
      const source = files
        .map((path) => flattenCopy(readProjectFile(path)))
        .join("\n")
      for (const line of lines) {
        assert.ok(
          source.includes(line),
          `${file} no longer contains "${line}" — update it in the harness lane too`
        )
        assert.ok(
          harness.includes(line),
          `the offers harness lane has drifted from ${file}: "${line}"`
        )
      }
    }
  })

  it("registers the DB-free harness lane for the offers surface", () => {
    const harnessRoutes = readProjectFile("tests/e2e/helpers/harness.ts")
    const a11ySweep = readProjectFile("tests/e2e/helpers/a11y-sweep.ts")
    const laneLayout = readProjectFile("app/dev/app-harness/layout.tsx")

    assert.equal(
      existsSync(join(projectRoot, "app/dev/app-harness/offers/page.tsx")),
      true
    )
    assert.equal(
      existsSync(
        join(projectRoot, "app/dev/app-harness/offers/harness-client.tsx")
      ),
      true
    )
    assert.match(harnessRoutes, /offers: "\/dev\/app-harness\/offers"/)
    assert.match(a11ySweep, /HARNESS_ROUTES\.offers/)
    assert.match(laneLayout, /offers: "\/app\/offers"/)
  })
})
