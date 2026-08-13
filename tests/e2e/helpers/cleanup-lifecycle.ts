export type CleanupStep = {
  readonly label: string
  readonly run: () => Promise<void>
}

export class CleanupStepError extends Error {
  readonly label: string

  constructor(label: string, cause: unknown) {
    super(`${label} failed.`, { cause })
    this.name = "CleanupStepError"
    this.label = label
  }
}

export async function runCleanupSteps(
  steps: readonly CleanupStep[],
  message: string
): Promise<void> {
  const failures: CleanupStepError[] = []

  for (const step of steps) {
    try {
      await step.run()
    } catch (error) {
      failures.push(new CleanupStepError(step.label, error))
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, message)
  }
}
