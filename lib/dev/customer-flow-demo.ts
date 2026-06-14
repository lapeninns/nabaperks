export {
  CUSTOMER_FLOW_COMMANDS,
  CUSTOMER_FLOW_DEMO,
  assertAdvancePreconditions,
  buildCustomerFlowJourneyLinks,
  customerFlowStatusFromRow,
  demoPhoneHmac,
  isCustomerFlowCommand,
  normalizeDemoPhone,
} from "./customer-flow-demo-types.ts"
export type {
  CustomerFlowCommand,
  CustomerFlowCommandInput,
  CustomerFlowCommandResult,
  CustomerFlowJourneyLinks,
  AdvanceResult,
  MakeRedeemableResult,
  ResetResult,
  CustomerFlowRewardRow,
  CustomerFlowRewardStatus,
  CustomerFlowStatus,
  CustomerFlowStatusRow,
  StampEventRow,
} from "./customer-flow-demo-types.ts"
export {
  advanceCustomerFlowDemo,
  getCustomerFlowStatus,
  makeCustomerFlowRewardRedeemable,
  resetCustomerFlowDemo,
  runCustomerFlowCommand,
} from "./customer-flow-demo-db.ts"
export { main, parseCustomerFlowArgs } from "./customer-flow-demo-cli.ts"
