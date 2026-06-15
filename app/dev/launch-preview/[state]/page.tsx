import { notFound } from "next/navigation"

import { LaunchPreviewScreen } from "@/app/dev/launch-preview/screens"
import {
  isLaunchPreviewStateId,
  launchPreviewState,
} from "@/lib/dev/launch-preview"

type LaunchPreviewPageProps = {
  params: Promise<{
    state: string
  }>
}

export default async function LaunchPreviewPage({
  params,
}: LaunchPreviewPageProps) {
  const { state } = await params

  if (!isLaunchPreviewStateId(state)) {
    notFound()
  }

  const previewState = launchPreviewState(state)

  return (
    <div
      data-launch-preview={state}
      data-screen-label={previewState.screenLabel}
    >
      <LaunchPreviewScreen stateId={state} />
    </div>
  )
}
