import { createRouter } from "radix3"
import { rllogger } from "./rl"
import type { KeyData } from "./key"
import type { RateLimitRule } from "../../../module"
import type { H3Event } from "h3"

export type CustomRuleFunction = (
  event: H3Event,
  data: KeyData,
  rule: RateLimitRule,
) => Promise<RateLimitRule>
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

  if (customRule === null) {
    return rule
  }

  delete customRule.params

  return await customRule.handler(event, data, rule)
}
