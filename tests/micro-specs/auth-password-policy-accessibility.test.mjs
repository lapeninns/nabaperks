import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("local provider and shared validator declare the same three-rule policy", () => {
  const config = readProjectFile("supabase", "config.toml")
  const password = readProjectFile("lib", "auth", "password.ts")

  assert.match(config, /minimum_password_length = 8/)
  assert.match(config, /password_requirements = "letters_digits"/)
  assert.match(password, /password_requirements = "letters_digits"/)
  assert.match(password, /hasLetter/)
  assert.match(password, /hasDigit/)
  assert.doesNotMatch(password, /hasLowercase|hasUppercase|hasSymbol/)
  assert.doesNotMatch(
    password,
    /PASSWORD_HINT|PASSWORD_SYMBOLS|hasPasswordSymbol/
  )
})

test("signup and reset expose persistent associated password requirements", () => {
  const requirements = readProjectFile(
    "components",
    "auth",
    "password-requirements.tsx"
  )
  const signup = readProjectFile(
    "components",
    "auth",
    "signup-details-form.tsx"
  )
  const reset = readProjectFile("components", "auth", "reset-password-form.tsx")
  const recoveryFlow = readProjectFile(
    "tests",
    "e2e",
    "merchant-auth-recovery-flow.ts"
  )

  for (const label of [
    "8 or more characters",
    "At least one letter",
    "At least one number",
  ]) {
    assert.match(requirements, new RegExp(label))
  }
  assert.match(requirements, /aria-atomic="true"/)
  assert.match(requirements, /Password meets all 3 rules/)
  assert.doesNotMatch(requirements, /role="tooltip"|cursor-help/)
  assert.match(signup, /aria-describedby="signup-password-requirements"/)
  assert.match(
    signup,
    /<PasswordRequirements[\s\S]{0,160}id="signup-password-requirements"/
  )
  assert.match(reset, /aria-describedby="reset-password-requirements"/)
  assert.match(
    reset,
    /<PasswordRequirements[\s\S]{0,160}id="reset-password-requirements"/
  )
  assert.match(recoveryFlow, /name: "Password requirements"/)
  assert.doesNotMatch(recoveryFlow, /name: "Password rules"/)
})

test("focused auth keeps one linked home mark and a static footer wordmark", () => {
  const logo = readProjectFile("components", "brand", "logo.tsx")
  const layout = readProjectFile("components", "layout", "marketing-layout.tsx")

  assert.match(logo, /linked = true/)
  assert.match(logo, /if \(!linked\)/)
  assert.match(layout, /focused[\s\S]*<Logo[^>]*linked=\{false\}/)
})

test("predecessor auth contracts point at the policy successor", () => {
  const merchantAuth = readProjectFile("micro-specs", "merchant", "auth.md")
  const recovery = readProjectFile("micro-specs", "auth", "recovery-ux.md")

  assert.match(merchantAuth, /MS-auth-password-policy-accessibility/)
  assert.match(recovery, /MS-auth-password-policy-accessibility/)
  assert.doesNotMatch(
    merchantAuth,
    /lacks both letters and digits, THEN THE system SHALL reject/
  )
})
