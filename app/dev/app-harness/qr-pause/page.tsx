import { notFound } from "next/navigation"
import { QrPauseHarness } from "./harness-client"

export default function QrPauseHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <QrPauseHarness />
}
