export type AfterResponseRegistrar = (task: () => void | Promise<void>) => void

/**
 * Register analytics with the framework's post-response lifecycle without
 * putting the returned task promise on an auth action's critical path.
 */
export function scheduleAfterResponseAnalytics(
  registerAfter: AfterResponseRegistrar,
  task: () => Promise<void>
): void {
  try {
    registerAfter(async () => {
      try {
        await task()
      } catch {
        // First-party analytics is observational; auth remains authoritative.
      }
    })
  } catch {
    // A lifecycle registration failure must not escape into the auth action.
  }
}
