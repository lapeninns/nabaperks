import { notFound } from "next/navigation"

import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { renderPosterQrCodePng } from "@/lib/qr/assets"

type PrintAssetSearchParams = {
  readonly qr?: string | readonly string[]
  readonly from?: string | readonly string[]
}

/** First value of a Next search param, which may arrive repeated. */
export function firstSearchValue(
  value: string | readonly string[] | undefined
): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return (value as string | undefined) ?? null
}

type ResolvedPrintAssetRequest<TDesign> = {
  readonly design: TDesign
  readonly qrCodeId: string
  readonly backHref: string
  readonly qrContext: NonNullable<
    Awaited<ReturnType<typeof getOwnedQrImageContext>>
  >
}

/**
 * The preamble every print-asset route shared verbatim: resolve params and
 * search params, look up the design, read the return href, 404 on a missing
 * design or QR id, then fetch the owned QR context and 404 again if the caller
 * does not own it.
 *
 * The four routes stay separate — tests/contracts/qr-a4-poster-templates pins
 * the poster URL shape and four e2e specs navigate the current paths — but the
 * ~35 lines of identical setup no longer live in four places. (03#37)
 */
export async function resolvePrintAssetRequest<TDesign>({
  params,
  searchParams,
  paramKey,
  getDesign,
}: {
  readonly params: Promise<Record<string, string>>
  readonly searchParams: Promise<PrintAssetSearchParams>
  /** Route segment carrying the design id — "design", or "template" on posters. */
  readonly paramKey: string
  readonly getDesign: (designId: string) => TDesign | undefined
}): Promise<ResolvedPrintAssetRequest<NonNullable<TDesign>>> {
  const [routeParams, query] = await Promise.all([params, searchParams])
  const design = getDesign(routeParams[paramKey] ?? "")
  const qrCodeId = firstSearchValue(query.qr)
  // `from` is user-controllable, so it is only ever resolved through the
  // allowlist — the raw value never reaches a redirect or href. Defaults to the
  // canonical /app/qr poster home.
  const backHref = resolveQrReturnBase(firstSearchValue(query.from))

  if (!design || !qrCodeId) notFound()

  const qrContext = await getOwnedQrImageContext(qrCodeId)
  if (!qrContext) notFound()

  return {
    design: design as NonNullable<TDesign>,
    qrCodeId,
    backHref,
    qrContext,
  }
}

/**
 * Render the sheet's QR to a data URL, or report the failure so the route can
 * show its own PrintAssetError with the right `kind`.
 */
export async function renderPrintAssetQr(
  url: string
): Promise<{ ok: true; qrDataUrl: string } | { ok: false }> {
  try {
    const png = await renderPosterQrCodePng(url, 900)
    return {
      ok: true,
      qrDataUrl: `data:image/png;base64,${png.toString("base64")}`,
    }
  } catch {
    return { ok: false }
  }
}
