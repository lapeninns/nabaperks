import { ActivityFeed, EmptyState } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <ActivityFeed
      items={[
        {
          id: "evt-1",
          title: "Stamp issued",
          description: "Maya R. earned stamp 7 of 8 on her flat white.",
          timestamp: "2026-06-27T08:42:00Z",
          tone: "accent",
        },
        {
          id: "evt-2",
          title: "Reward redeemed",
          description: "Free oat latte claimed at the counter.",
          timestamp: "2026-06-27T08:15:00Z",
          tone: "leaf",
        },
        {
          id: "evt-3",
          title: "New member joined",
          description: "Scanned the table QR and started a card.",
          timestamp: "2026-06-27T07:58:00Z",
          tone: "sun",
        },
      ]}
    />
  </div>
)

export const Tones = () => (
  <div className="max-w-md">
    <ActivityFeed
      items={[
        {
          id: "tone-accent",
          title: "Stamp issued",
          metadata: "Bridge Street Coffee · Counter QR",
          timestamp: "2026-06-27T09:30:00Z",
          tone: "accent",
        },
        {
          id: "tone-leaf",
          title: "Reward redeemed",
          metadata: "Bridge Street Coffee · 9th coffee free",
          timestamp: "2026-06-27T09:12:00Z",
          tone: "leaf",
        },
        {
          id: "tone-sun",
          title: "Card completed",
          metadata: "Maya R. filled all 8 stamps",
          timestamp: "2026-06-27T08:47:00Z",
          tone: "sun",
        },
        {
          id: "tone-ink",
          title: "Campaign launched",
          metadata: "Double stamp Tuesdays is now live",
          timestamp: "2026-06-26T16:00:00Z",
          tone: "ink",
        },
        {
          id: "tone-plain",
          title: "Member opted out",
          metadata: "Unsubscribed from reward reminders",
          timestamp: "2026-06-26T11:20:00Z",
          tone: "plain",
        },
      ]}
    />
  </div>
)

export const Empty = () => (
  <div className="max-w-md">
    <ActivityFeed
      items={[]}
      emptyState={
        <EmptyState
          title="No activity yet"
          description="Stamps and redemptions will show up here the moment your counter goes live."
        />
      }
    />
  </div>
)
