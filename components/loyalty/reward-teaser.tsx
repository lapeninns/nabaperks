import type { ReactNode } from "react"

import { RewardTicket } from "./reward-ticket"

/**
 * Back-compat shim — the reward panel is now the {@link RewardTicket}. Call
 * sites that still pass the old `locked` flag map onto the sealed / ready ticket
 * states; new code should render {@link RewardTicket} directly with an explicit
 * state (sealed / waiting / ready / redeemed).
 *
 * @deprecated Use {@link RewardTicket}.
 */
export function RewardTeaser({
  locked,
  title,
  description,
  className,
}: {
  locked: boolean
  title: ReactNode
  description?: ReactNode
  /** Accepted for back-compat; the ticket stub always carries its own seal. */
  hideSeal?: boolean
  className?: string
}) {
  return (
    <RewardTicket
      state={locked ? "sealed" : "ready"}
      name={title}
      description={description}
      className={className}
    />
  )
}
