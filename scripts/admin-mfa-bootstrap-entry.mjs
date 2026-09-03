import { createClient } from "@supabase/supabase-js"

import { registerAdminWebAuthnFactor } from "../lib/admin/webauthn-mfa.ts"

const config = globalThis.__ADMIN_MFA_BOOTSTRAP_CONFIG__
if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
  throw new Error("Administrator MFA bootstrap configuration is missing.")
}

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
const form = document.querySelector("form")
const emailInput = document.querySelector("#email")
const codeInput = document.querySelector("#code")
const primaryButton = document.querySelector("#primary-action")
const status = document.querySelector("#status")
let stage = "email"
let email = ""

function showStatus(message, isError = false) {
  status.textContent = message
  status.dataset.error = String(isError)
}

function setStage(nextStage) {
  stage = nextStage
  emailInput.closest("label").hidden = nextStage !== "email"
  codeInput.closest("label").hidden = nextStage !== "code"
  primaryButton.textContent =
    nextStage === "email"
      ? "Send sign-in code"
      : nextStage === "code"
        ? "Verify sign-in code"
        : "Register security key"
}

async function sendCode() {
  email = emailInput.value.trim()
  if (!email) throw new Error("Enter the administrator email address.")
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
  setStage("code")
  showStatus("Check the administrator mailbox for the six-digit code.")
}

async function verifyCode() {
  const token = codeInput.value.replace(/\s+/g, "")
  if (!/^\d{6}$/.test(token)) {
    throw new Error("Enter the six-digit sign-in code.")
  }
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  })
  if (error) throw error
  const eligibility = await supabase.rpc("can_bootstrap_admin_webauthn")
  if (eligibility.error || eligibility.data !== true) {
    throw new Error("This account is not eligible for administrator MFA setup.")
  }
  setStage("ready")
  showStatus(
    "Identity confirmed. Your device will now require a PIN, biometric, or screen lock."
  )
}

async function register() {
  const result = await registerAdminWebAuthnFactor(supabase)
  if (!result.ok) throw new Error(result.error)
  form.hidden = true
  showStatus(
    "The security key is verified and awaiting independent activation. You may close this page."
  )
}

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  primaryButton.disabled = true
  showStatus("Working…")
  try {
    if (stage === "email") await sendCode()
    else if (stage === "code") await verifyCode()
    else await register()
  } catch {
    showStatus(
      "The request could not be completed. Check the details and try again.",
      true
    )
  } finally {
    primaryButton.disabled = false
  }
})
