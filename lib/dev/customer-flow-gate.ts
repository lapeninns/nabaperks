export function isCustomerFlowDevHarnessEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  configured = process.env.CUSTOMER_FLOW_DEV_HARNESS_ENABLED
): boolean {
  return nodeEnv !== "production" && configured?.trim() === "true"
}
