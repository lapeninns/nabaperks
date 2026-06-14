"use server"

import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"

import {
  advanceCustomerFlowDemo,
  makeCustomerFlowRewardRedeemable,
  resetCustomerFlowDemo,
} from "@/lib/dev/customer-flow-demo"
import { isCustomerFlowDevHarnessEnabled } from "@/lib/dev/customer-flow-gate"

const DEV_CUSTOMER_FLOW_PATH = "/dev/customer-flow"

export async function resetDemoCustomerAction(): Promise<never> {
  return runDemoMutation("Customer reset.", () => resetCustomerFlowDemo())
}

export async function advanceZeroStampsAction(): Promise<never> {
  return runDemoMutation("Advanced with zero stamps.", () =>
    advanceCustomerFlowDemo(0)
  )
}

export async function advanceOneStampAction(): Promise<never> {
  return runDemoMutation("Advanced with one stamp.", () =>
    advanceCustomerFlowDemo(1)
  )
}

export async function advanceTwoStampsAction(): Promise<never> {
  return runDemoMutation("Advanced with two stamps.", () =>
    advanceCustomerFlowDemo(2)
  )
}

export async function makeRewardRedeemableAction(): Promise<never> {
  return runDemoMutation("Reward made redeemable.", () =>
    makeCustomerFlowRewardRedeemable()
  )
}

async function runDemoMutation(
  successMessage: string,
  operation: () => Promise<unknown>
): Promise<never> {
  if (!isCustomerFlowDevHarnessEnabled()) {
    notFound()
  }

  let target = resultUrl("message", successMessage)

  try {
    await operation()
    revalidatePath(DEV_CUSTOMER_FLOW_PATH)
  } catch (error) {
    if (error instanceof Error) {
      target = resultUrl("error", error.message)
    } else {
      throw error
    }
  }

  redirect(target)
}

function resultUrl(key: "message" | "error", value: string): string {
  const params = new URLSearchParams({ [key]: value })
  return `${DEV_CUSTOMER_FLOW_PATH}?${params.toString()}`
}
