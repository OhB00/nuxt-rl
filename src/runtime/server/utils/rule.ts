import { createRouter } from "radix3"
import type { KeyData } from "./key"
import type { RateLimitRule } from "../../../module"
import type { H3Event } from "h3"

export type CustomRuleFunction = (
  event: H3Event,
  data: RuleOverrideData,
  rule: RateLimitRule,
) => Promise<RateLimitRule>

export interface RuleOverrideData {
  key: string
  metadata: Record<string, string>
}

export const customRuleRouter = createRouter<{ handler: CustomRuleFunction }>()

export function addCustomRule(path: string, fn: CustomRuleFunction) {
  customRuleRouter.insert(path, { handler: fn })
}

export async function getRule(
  event: H3Event,
  data: KeyData,
  rule: RateLimitRule,
) {
  const customRule = customRuleRouter.lookup(event.path)

  if (customRule === null || data.success === false) {
    return rule
  }

  delete customRule.params

  return await customRule.handler(event, {
    key: data.key,
    metadata: data.metadata
  }, rule)
}
