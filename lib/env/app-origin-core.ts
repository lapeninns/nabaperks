export type AppOriginEnvironment = {
  readonly NEXT_PUBLIC_APP_URL?: string
  readonly VERCEL_ENV?: string
  readonly VERCEL_TARGET_ENV?: string
  readonly VERCEL_URL?: string
}

function explicitOrigin(value: string | undefined, hosted: boolean): string {
  const configured = value?.trim()
  if (!configured) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for this environment")
  }

  const url = parseOrigin(configured)
  if (!url || (hosted && url.protocol !== "https:")) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a canonical HTTP(S) origin")
  }

  return url.origin
}

function previewDeploymentOrigin(value: string | undefined): string {
  const deploymentHost = value?.trim().toLowerCase()
  if (
    !deploymentHost ||
    deploymentHost.includes("://") ||
    !deploymentHost.endsWith(".vercel.app")
  ) {
    throw new Error(
      "VERCEL_URL must identify the current immutable Vercel deployment"
    )
  }

  const url = parseOrigin(`https://${deploymentHost}`)
  if (!url) {
    throw new Error(
      "VERCEL_URL must identify the current immutable Vercel deployment"
    )
  }

  return url.origin
}

function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

/**
 * Resolve the canonical origin embedded in provider return URLs and generated
 * QR codes. Generic previews must point at their immutable deployment, while
 * Production and the custom Staging target keep operator-owned canonical URLs.
 */
export function resolveCanonicalAppOrigin(
  environment: AppOriginEnvironment
): string {
  const vercelEnvironment = environment.VERCEL_ENV?.trim().toLowerCase()
  const targetEnvironment = environment.VERCEL_TARGET_ENV?.trim().toLowerCase()
  const genericPreview =
    vercelEnvironment === "preview" && targetEnvironment !== "staging"

  if (genericPreview) {
    return previewDeploymentOrigin(environment.VERCEL_URL)
  }

  const hosted =
    vercelEnvironment === "production" || targetEnvironment === "staging"
  return explicitOrigin(environment.NEXT_PUBLIC_APP_URL, hosted)
}
