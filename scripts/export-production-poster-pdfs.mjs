import { mkdir, writeFile } from "node:fs/promises"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { createClient } from "@supabase/supabase-js"

import { normalizeGoogleReviewUrl } from "@/lib/customer/venue-details"
import { closePrintKitBrowser } from "@/lib/notifications/print-kit-browser"
import { withStagedOutputDirectory } from "@/lib/notifications/print-kit-output-directory"
import {
  buildNfcCardPdfAttachmentsFromPreview,
  buildNfcSquarePdfAttachmentsFromPreview,
  buildPosterPdfAttachmentsFromPreview,
  buildTentPdfAttachmentsFromPreview,
} from "@/lib/notifications/print-kit-preview-export"
import { assertPrintKitPreviewOrigin } from "@/lib/notifications/print-kit-preview-pdf"
import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import { QR_POSTER_PRODUCTION_DUPLEX_PAIRS } from "@/lib/qr/poster-duplex-pairs"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"
import {
  assertProductionPosterSupabaseTarget,
  readCanonicalProductionSupabaseRef,
  resolveProductionPosterCredentials,
} from "./production-poster-supabase-target.mjs"

const DEFAULT_APP_ORIGIN = "https://nabaperks.com"
const DEFAULT_OUTPUT = path.join("output", "posters")
const DEFAULT_LOCAL_ENV = ".env.local"
const DEFAULT_PREVIEW_ORIGIN = "http://127.0.0.1:3000"

const ASSET_FOLDERS = {
  posters: "posters",
  nfcCards: "nfc-cards",
  nfcPlates: "nfc-plates",
  tableTents: "table-tents",
}

/**
 * Export every production-rotation printable for each merchant with an active
 * join QR. Posters ship as duplex (2-page) PDFs; NFC cards/plates and table
 * tents are single-design files. All renders go through Playwright /dev
 * preview routes. Requires a local Next server (`pnpm dev`).
 *
 *   output/posters/
 *     _manifest.json
 *     {venue-slug}__{qr-id}/
 *       posters/nabaperks-poster-{front}-{back}.pdf
 *       nfc-cards/nabaperks-nfc-card-*.pdf
 *       nfc-plates/nabaperks-nfc-plate-*.pdf
 *       table-tents/nabaperks-tent-*.pdf
 *
 * Usage:
 *   pnpm dev   # in another terminal
 *   # Export the two required variables into the process environment, or use
 *   # an explicitly selected credential file stored outside the repository:
 *   pnpm posters:export-production -- --env-file /secure/path/posters.env
 *   pnpm posters:export-production -- --env-file /secure/path/posters.env --limit 1
 *   pnpm posters:export-production -- --preview-origin http://127.0.0.1:3000
 */

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const out = {}
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const i = trimmed.indexOf("=")
    if (i < 0) continue
    let value = trimmed.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[trimmed.slice(0, i).trim()] = value
  }
  return out
}

function parseArgs(argv) {
  const args = {
    limit: null,
    allowLocal: false,
    envFile: null,
    outputDir: DEFAULT_OUTPUT,
    appOrigin: DEFAULT_APP_ORIGIN,
    previewOrigin: DEFAULT_PREVIEW_ORIGIN,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--") continue
    if (token === "--allow-local") {
      args.allowLocal = true
      continue
    }
    if (token === "--limit") {
      const raw = argv[i + 1]
      const value = Number(raw)
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit expects a positive integer, got ${raw}`)
      }
      args.limit = value
      i += 1
      continue
    }
    if (token === "--env-file") {
      args.envFile = argv[++i]
      continue
    }
    if (token === "--output") {
      args.outputDir = argv[++i]
      continue
    }
    if (token === "--app-origin") {
      args.appOrigin = argv[++i].replace(/\/$/, "")
      continue
    }
    if (token === "--preview-origin") {
      args.previewOrigin = argv[++i].replace(/\/$/, "")
      continue
    }
    throw new Error(`Unknown argument: ${token}`)
  }
  if (!args.envFile) {
    args.envFile = args.allowLocal ? DEFAULT_LOCAL_ENV : null
  }
  return args
}

async function writePdfBundle(dir, attachments) {
  await mkdir(dir, { recursive: true })
  const files = []
  for (const attachment of attachments) {
    await writeFile(
      path.join(dir, attachment.filename),
      Buffer.from(attachment.content, "base64")
    )
    files.push(path.posix.join(path.basename(dir), attachment.filename))
  }
  return files
}

function sanitizeFolderPart(value) {
  return (
    String(value || "venue")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "venue"
  )
}

function venueFolderName({ businessSlug, businessName, qrId }) {
  const base = sanitizeFolderPart(businessSlug || businessName)
  return `${base}__${sanitizeFolderPart(qrId)}`
}

async function loadActiveJoinVenues(supabase, limit) {
  let query = supabase
    .from("qr_codes")
    .select(
      `
      id,
      qr_id,
      is_active,
      destination_type,
      loyalty_card_id,
      merchants!inner (
        id,
        business_name,
        business_slug,
        pub_google_review,
        locals
      )
    `
    )
    .eq("is_active", true)
    .eq("destination_type", "join")
    .order("created_at", { ascending: true })

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    throw new Error(`Unable to load active join QRs: ${error.message}`)
  }

  const cardIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.loyalty_card_id)
        .filter((id) => typeof id === "string" && id.length > 0)
    ),
  ]

  const stampsByCardId = new Map()
  if (cardIds.length > 0) {
    const { data: cards, error: cardError } = await supabase
      .from("loyalty_cards")
      .select("id, stamps_required")
      .in("id", cardIds)
    if (cardError) {
      throw new Error(`Unable to load loyalty cards: ${cardError.message}`)
    }
    for (const card of cards ?? []) {
      stampsByCardId.set(card.id, card.stamps_required)
    }
  }

  const venues = []
  for (const row of data ?? []) {
    const merchant = Array.isArray(row.merchants)
      ? row.merchants[0]
      : row.merchants
    const stampsRequired = Number(stampsByCardId.get(row.loyalty_card_id))
    if (!merchant?.business_name || !row.qr_id) continue
    if (!Number.isInteger(stampsRequired) || stampsRequired < 1) {
      console.warn(`Skipping ${row.qr_id}: missing or invalid stamps_required`)
      continue
    }
    venues.push({
      merchantId: merchant.id,
      businessName: merchant.business_name,
      businessSlug: merchant.business_slug ?? null,
      qrId: row.qr_id,
      stampsRequired,
      googleReviewUrl: normalizeGoogleReviewUrl(
        merchant.pub_google_review ?? null
      ),
      locality:
        typeof merchant.locals === "string" && merchant.locals.trim()
          ? merchant.locals.trim()
          : null,
    })
  }
  return venues
}

async function exportVenuePrintables(
  venue,
  outputRoot,
  previewOrigin,
  appOrigin
) {
  const folderName = venueFolderName(venue)
  const venueDir = path.join(outputRoot, folderName)
  await mkdir(venueDir, { recursive: true })

  const previewInput = {
    previewOrigin,
    appOrigin,
    merchantName: venue.businessName,
    qrId: venue.qrId,
    stampsRequired: venue.stampsRequired,
    locality: venue.locality,
    googleReviewUrl: venue.googleReviewUrl,
  }

  // Serial per venue keeps Chromium memory predictable across designs.
  const posters = await buildPosterPdfAttachmentsFromPreview(previewInput)
  const nfcCards = await buildNfcCardPdfAttachmentsFromPreview(previewInput)
  const nfcSquares = await buildNfcSquarePdfAttachmentsFromPreview(previewInput)
  const tents = await buildTentPdfAttachmentsFromPreview(previewInput)

  if (!venue.googleReviewUrl) {
    console.warn(
      `Skipping Google review NFC designs for ${venue.businessName}: no valid pub_google_review URL`
    )
  }

  const posterFiles = await writePdfBundle(
    path.join(venueDir, ASSET_FOLDERS.posters),
    posters
  )
  const nfcFiles = await writePdfBundle(
    path.join(venueDir, ASSET_FOLDERS.nfcCards),
    nfcCards
  )
  const nfcSquareFiles = await writePdfBundle(
    path.join(venueDir, ASSET_FOLDERS.nfcPlates),
    nfcSquares
  )
  const tentFiles = await writePdfBundle(
    path.join(venueDir, ASSET_FOLDERS.tableTents),
    tents
  )

  return {
    folder: folderName,
    merchantId: venue.merchantId,
    businessName: venue.businessName,
    businessSlug: venue.businessSlug,
    qrId: venue.qrId,
    stampsRequired: venue.stampsRequired,
    shareUrl: `${appOrigin}/q/${venue.qrId}`,
    googleReviewUrl: venue.googleReviewUrl,
    locality: venue.locality,
    assetFolders: ASSET_FOLDERS,
    posterFiles,
    tentFiles,
    nfcFiles,
    nfcSquareFiles,
    files: [...posterFiles, ...nfcFiles, ...nfcSquareFiles, ...tentFiles],
  }
}

export async function exportProductionPosterPdfs(options = {}) {
  const envPath = options.envFile ? path.resolve(options.envFile) : null
  const fileEnv = envPath ? readEnvFile(envPath) : {}
  const { serviceRoleKey, supabaseUrl } = resolveProductionPosterCredentials({
    envFileSelected: Boolean(envPath),
    fileEnv,
    processEnv: process.env,
  })

  const authorisedSupabaseOrigin = assertProductionPosterSupabaseTarget(
    supabaseUrl,
    {
      allowLocal: Boolean(options.allowLocal),
      productionRef: readCanonicalProductionSupabaseRef(),
    }
  )

  const appOrigin = (options.appOrigin || DEFAULT_APP_ORIGIN).replace(/\/$/, "")
  const previewOrigin = (
    options.previewOrigin || DEFAULT_PREVIEW_ORIGIN
  ).replace(/\/$/, "")
  await assertPrintKitPreviewOrigin(previewOrigin)

  const outputRoot = path.resolve(options.outputDir || DEFAULT_OUTPUT)

  const supabase = createClient(authorisedSupabaseOrigin, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const venues = await loadActiveJoinVenues(supabase, options.limit ?? null)
  if (venues.length === 0) {
    throw new Error("No active join QR venues found to export.")
  }

  return withStagedOutputDirectory(outputRoot, async (stagedRoot) => {
    const results = []
    for (const venue of venues) {
      console.log(
        `Rendering (preview WYSIWYG) ${QR_POSTER_PRODUCTION_DUPLEX_PAIRS.length} duplex posters + ${NFC_CARD_PRODUCTION_DESIGNS.length} NFC cards + ${NFC_SQUARE_PRODUCTION_DESIGNS.length} NFC plates + ${TENT_PRODUCTION_DESIGNS.length} tents for ${venue.businessName} (${venue.qrId})…`
      )
      results.push(
        await exportVenuePrintables(venue, stagedRoot, previewOrigin, appOrigin)
      )
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      appOrigin,
      previewOrigin,
      renderMode: "playwright-dev-preview",
      supabaseHost: new URL(authorisedSupabaseOrigin).hostname,
      layout: {
        root: path.basename(outputRoot),
        perVenue:
          "typed folders — posters/, nfc-cards/, nfc-plates/, table-tents/",
        assetFolders: ASSET_FOLDERS,
        posterMode: "duplex-2-page",
      },
      posterDuplexPairs: QR_POSTER_PRODUCTION_DUPLEX_PAIRS.map(
        ({ front, back }) => `${front}+${back}`
      ),
      tentDesignIds: TENT_PRODUCTION_DESIGNS.map(({ id }) => id),
      nfcDesignIds: NFC_CARD_PRODUCTION_DESIGNS.map(({ id }) => id),
      nfcSquareDesignIds: NFC_SQUARE_PRODUCTION_DESIGNS.map(({ id }) => id),
      venueCount: results.length,
      posterCount: results.reduce(
        (sum, row) => sum + row.posterFiles.length,
        0
      ),
      tentCount: results.reduce((sum, row) => sum + row.tentFiles.length, 0),
      nfcCount: results.reduce((sum, row) => sum + row.nfcFiles.length, 0),
      nfcSquareCount: results.reduce(
        (sum, row) => sum + row.nfcSquareFiles.length,
        0
      ),
      pdfCount: results.reduce((sum, row) => sum + row.files.length, 0),
      venues: results,
    }

    await writeFile(
      path.join(stagedRoot, "_manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
    return manifest
  })
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : ""

if (import.meta.url === invokedPath) {
  const args = parseArgs(process.argv.slice(2))
  try {
    const manifest = await exportProductionPosterPdfs(args)
    console.log(
      `Exported ${manifest.pdfCount} PDFs across ${manifest.venueCount} venues into ${path.resolve(args.outputDir)}`
    )
    console.log(`Render mode: Playwright /dev preview at ${args.previewOrigin}`)
  } finally {
    await closePrintKitBrowser()
  }
}
