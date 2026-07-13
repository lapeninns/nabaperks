import { request, type FullConfig } from "@playwright/test"

import { HARNESS_ROUTES } from "./helpers/harness"

export default async function warmHarnessRoutes(
  config: FullConfig
): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL

  if (typeof baseURL !== "string") {
    throw new Error("Playwright global setup requires a string baseURL")
  }

  const api = await request.newContext({ baseURL })

  try {
    for (const path of new Set(Object.values(HARNESS_ROUTES))) {
      const response = await api.get(path, { failOnStatusCode: false })

      if (!response.ok()) {
        const body = (await response.text()).slice(0, 500)
        throw new Error(
          `Harness warm-up failed for ${path}: HTTP ${response.status()}\n${body}`
        )
      }
    }
  } finally {
    await api.dispose()
  }
}
