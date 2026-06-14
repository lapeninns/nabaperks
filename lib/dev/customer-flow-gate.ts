export function isCustomerFlowDevHarnessEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv !== "production"
}
