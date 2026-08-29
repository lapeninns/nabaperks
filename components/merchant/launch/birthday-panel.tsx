import { PageTitle } from "@/components/brand"
import { BirthdayRewardForm } from "@/components/merchant/launch/birthday-reward-form"
import type { BirthdayRewardActionState } from "@/app/app/card/actions"
import type { BirthdayRewardTemplate } from "@/lib/merchant/birthday-reward-template"

/**
 * The merchant birthday-reward config, rendered inside the Rewards panel from
 * the same `getLoyaltyCardSetup` card row (zero extra queries). Presentational;
 * the client form owns the save action.
 */
export function BirthdayRewardPanel({
  loyaltyCardId,
  enabled,
  rewardName,
  rewardTerms,
  template,
  saveAction,
}: {
  loyaltyCardId: string
  enabled: boolean
  rewardName: string | null
  rewardTerms: string | null
  template: BirthdayRewardTemplate
  saveAction?: (
    state: BirthdayRewardActionState,
    formData: FormData
  ) => Promise<BirthdayRewardActionState>
}) {
  return (
    <section className="surface-card grid min-w-0 gap-4 p-3 sm:p-6">
      <PageTitle
        headingLevel={2}
        eyebrow="Optional"
        title="Birthday treat"
        description="Automatically issue a reward during each member's birthday month. It redeems like any other reward and expires at month end."
        titleClassName="sm:text-xl"
      />
      <BirthdayRewardForm
        loyaltyCardId={loyaltyCardId}
        initialValues={{
          enabled,
          rewardName: rewardName ?? "",
          rewardTerms: rewardTerms ?? "",
        }}
        template={template}
        saveAction={saveAction}
      />
    </section>
  )
}
