const FEATURE_FLAGS = {
  platform_error_reporting: {
    environmentVariable: "NABAPERKS_FEATURE_PLATFORM_ERROR_REPORTING",
    defaultEnabled: true,
  },
} as const

export type FeatureFlagName = keyof typeof FEATURE_FLAGS

type FeatureFlagEnvironment = Readonly<Record<string, string | undefined>>

export function isFeatureEnabled(
  name: FeatureFlagName,
  environment: FeatureFlagEnvironment = process.env
): boolean {
  const definition = FEATURE_FLAGS[name]
  const override = environment[definition.environmentVariable]

  if (override === undefined || override.trim() === "") {
    return definition.defaultEnabled
  }

  return override.trim().toLowerCase() === "true"
}
