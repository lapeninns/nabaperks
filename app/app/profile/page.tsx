import { redirect } from "next/navigation"

// Profile now lives in the Account hub. Keep this route as a redirect so old
// links and bookmarks land on the Profile tab.
export default async function MerchantProfilePage() {
  redirect("/app/account?tab=profile")
}
