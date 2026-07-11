import {
  QrWorkspace,
  type DistributionChannel,
} from "@/components/merchant/launch/qr-redesign-concept"
import { buildPosterHrefs } from "@/components/merchant/launch/qr-redesign-concept-parts"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

export function QrRedesignConcept({
  activeCardName,
  venueName,
  shareUrl,
  qrDataUrl,
  channel,
  template,
}: {
  readonly activeCardName: string
  readonly venueName: string
  readonly shareUrl: string
  readonly qrDataUrl: string
  readonly channel: DistributionChannel
  readonly template: QrPosterTemplateId
}) {
  return (
    <QrWorkspace
      activeCardName={activeCardName}
      stampsRequired={3}
      venueName={venueName}
      shareUrl={shareUrl}
      qrImageSrc={qrDataUrl}
      channel={channel}
      template={template}
      status="live"
      navigationBaseHref="/dev/app-harness/launch?state=live&tab=qr&concept=redesign"
      posterHrefs={buildPosterHrefs(
        (id) => `/dev/poster-preview?template=${id}`
      )}
    />
  )
}
