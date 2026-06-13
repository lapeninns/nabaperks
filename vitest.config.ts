import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { defineConfig } from "vitest/config"

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
  resolve: {
    alias: {
      "@": rootDir,
      "server-only": resolve(rootDir, "tests/helpers/server-only.ts"),
    },
  },
})
