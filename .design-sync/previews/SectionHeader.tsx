import { SectionHeader, Button } from "nabaperks"

export const Default = () => (
  <SectionHeader
    eyebrow="This week"
    title="Stamps issued"
    description="Activity across Bridge Street Coffee since Monday."
  />
)

export const WithActions = () => (
  <SectionHeader
    eyebrow="Rewards"
    title="Pending redemptions"
    description="Three members are one stamp away from a free flat white."
    actions={
      <>
        <Button variant="outline" size="sm">
          Export
        </Button>
        <Button size="sm">New reward</Button>
      </>
    }
  />
)

export const TitleOnly = () => <SectionHeader title="Recent activity" />
