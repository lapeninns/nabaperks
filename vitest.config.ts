import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { defineConfig } from "vitest/config"

const rootDir = dirname(fileURLToPath(import.meta.url))

// Coverage is scoped to `lib/**` — the domain/business logic that the Vitest
// suite executes directly (UI and routes are exercised through source-structure
// tests, not by running the components). Thresholds act as a regression ratchet:
// raise them as coverage grows, never lower them to make a run pass.
export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", ".claude/**"],
    globals: true,
    // Auto-unregisters `vi.doMock` mocks after every test so leaked module mocks
    // cannot make the suite order-dependent under `--sequence.shuffle`.
    setupFiles: ["./tests/helpers/reset-module-mocks.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // Flag tests slower than 300ms so duration regressions surface in CI logs.
    slowTestThreshold: 300,
    reporters: process.env.CI
      ? ["default", ["junit", { outputFile: "test-results/vitest-junit.xml" }]]
      : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.d.ts",
        "lib/dev/**",
        "lib/**/types.ts",
        "lib/.gitkeep",
      ],
      // Baseline (2026-06): statements 62.6 / branches 49.8 / functions 70.2 /
      // lines 65.5. Set just below to ratchet against regressions, not to gate
      // on an aspirational number.
      thresholds: {
        statements: 60,
        branches: 47,
        functions: 67,
        lines: 62,
      },
    },
  },
  resolve: {
    alias: {
      "@": rootDir,
      "server-only": resolve(rootDir, "tests/helpers/server-only.ts"),
    },
  },
})
