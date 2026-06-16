import { redirect } from "next/navigation"

// Legacy route — settings lived here before the Account hub. Send old links home.
export default async function MerchantSettingsPage() {
  redirect("/app/account")
}
