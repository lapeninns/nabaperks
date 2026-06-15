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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated reports and artifacts.
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    ".jscpd/**",
    // Non-app artifacts.
    "docs/**/*.tsx",
    ".tmp/**",
    // Ephemeral agent worktree scratch space.
    ".claude/**",
  ]),
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
            {
              group: ["@/lib/dev", "@/lib/dev/**", "@/tests/**"],
              message:
                "Dev-only and test modules must not be imported into components.",
            },
          ],
        },
      ],
    },
  },
  // Production app/lib code must not depend on dev-only or test modules.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["app/dev/**", "lib/dev/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/dev", "@/lib/dev/**", "@/tests/**"],
              message:
                "Dev-only and test modules must not be imported into production code paths.",
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
