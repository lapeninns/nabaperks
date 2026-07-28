type RewardInviteSuppressionRead = {
  readonly data: unknown
  readonly error: unknown
}

/**
 * Email suppression is a consent boundary, so an unreadable suppression list
 * must stop delivery just as an explicit suppression row does.
 */
export function shouldSuppressRewardInviteEmail(
  result: RewardInviteSuppressionRead
): boolean {
  return Boolean(result.error) || Boolean(result.data)
}
