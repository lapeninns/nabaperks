// Code-health ratchet — separate from the functional `eslint.config.mjs` so it
// never blocks the dev/CI lint on style debt. It reports cyclomatic complexity,
// file/function size, nesting depth, and parameter counts as warnings; the
// `quality:guard` script pins `--max-warnings` to the current count so existing
// code is grandfathered while any *new* violation fails CI. Ratchet the
// thresholds (and the pinned count) down over time; never up.
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

// No-op stubs for the `@next/next` rules referenced by inline disable directives
// in product files. This config intentionally does not load the Next plugin (it
// only measures code health), so the stubs keep those directives resolvable.
const nextRuleStub = { create: () => ({}) }
const noopNextPlugin = {
  rules: {
    "no-img-element": nextRuleStub,
    "no-html-link-for-pages": nextRuleStub,
  },
}

const qualityConfig = defineConfig([
  {
    plugins: { "@next/next": noopNextPlugin },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "node_modules/**",
    ".tmp/**",
    ".claude/**",
    "docs/**",
    // Vendored shadcn design-system primitives — owned upstream, not our debt.
    "components/ui/**",
    // Dev-only mock harness that re-implements customer screens with fake forms.
    "app/dev/**",
  ]),
  {
    files: [
      "app/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // The `@next/next` rules above are no-op stubs (this config does not load the
      // Next plugin), so legitimate inline `@next/next/*` disable directives in
      // product files would otherwise be reported as unused here. Directive hygiene
      // is enforced by the functional eslint.config.mjs, where those rules run.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 6],
      "max-nested-callbacks": ["warn", 4],
      "max-lines": [
        "warn",
        { max: 450, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "warn",
        { max: 160, skipBlankLines: true, skipComments: true },
      ],
    },
  },
])

export default qualityConfig
