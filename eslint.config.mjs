import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".vercel/output/**",
    ".omo/evidence/**",
    ".tmp/**",
    ".design-sync/**",
    ".ds-sync/**",
    "ds-bundle/**",
    // Ephemeral agent worktree scratch space.
    ".claude/**",
  ]),
  // Repository-wide maintainability budgets. The 1,000-line ceiling is a
  // guardrail for orchestration modules, while the complexity rule keeps
  // branch-heavy logic visible during normal lint feedback.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "*.{ts,tsx}",
    ],
    rules: {
      complexity: ["error", 40],
      "max-lines": [
        "error",
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // The activity display adapter exhaustively translates a large historical
  // event vocabulary. Keep it inside the complexity analysis while giving
  // that single boundary a higher ceiling than normal product code.
  {
    files: ["lib/merchant/activity-display.ts"],
    rules: {
      complexity: ["error", 100],
    },
  },
  // Module boundaries. Presentational components never construct Supabase
  // server/service-role clients — data arrives as props from Server Components.
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/server", "**/lib/supabase/server"],
              message:
                "Components must not build Supabase server/service-role clients; pass data in as props from a Server Component.",
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
