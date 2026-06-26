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
    ".vercel/output/**",
    ".omo/evidence/**",
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
          ],
        },
      ],
    },
  },
])

export default eslintConfig
