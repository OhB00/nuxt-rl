import { DefaultRateLimitRule, RateLimitRule, RlOptions } from "../../../module"

import { createRouter } from "radix3"
import type { H3Event } from "h3"
import { getKeyData } from "./key"
import { useLogger } from "@nuxt/kit"
import { addCustomRule, getRule } from "./rule"

export type RateLimitEntry = {
  start: number
  end: number
  count: number
}

export type RateLimitResult =
  | {
      limited: true
      rule: RateLimitRule
      entry: RateLimitEntry
    }
  | {
      limited: false
      rule: RateLimitRule | null
      entry: RateLimitEntry | null
    }

export const rldata = useStorage("rl:data")
export const rllogger = useLogger("rl")

rllogger.level = 4

export async function isRateLimited(
  event: H3Event,
  options: RlOptions,
): Promise<RateLimitResult> {
  // This is likely slow to do on every request but I don't see a better option
  const { globalRouter, router } = getRouters(options)

  // Check if this route has a specific rule
  let rule = router.lookup(event.path)

  // There is no applicable rule
  if (rule === null) {
    // If global rules have been disabled
    if (!globalRouter) {
      return {
        limited: false,
        rule: null,
        entry: null,
      }
    }

    // Search if global rules apply to this route
    rule = globalRouter.lookup(event.path)

    // No global rule? Rate limits dont apply, go ham
    if (rule === null) {
      return {
        limited: false,
        rule: null,
        entry: null,
      }
    }
  }

  // Remove params bit from router
  delete rule.params

  const data = await getKeyData(event)
  const entry = await rldata.getItem<RateLimitEntry>(data.key)

  // Try override the existing rule if there a custom one in place
  rule = await getRule(event, data, rule)

  // This client has sent a request before
  if (entry) {
    const now = new Date()
    const start = new Date(entry.start)
    const end = new Date(entry.end)

    if (now >= start && now <= end) {
      if (++entry.count > rule.limit) {
        return {
          limited: true,
          entry,
          rule,
        }
      }

      // Update the storage with the new count
      await rldata.setItem(data.key, entry)

      return {
        limited: false,
        entry,
        rule,
      }
    }
  }

  // Handle case of ratelimit 0
  if (rule.limit == 0) {
    return {
      limited: true,
      entry: {
        start: 0,
        end: 0,
        count: 0,
      },
      rule,
    }
  }

  // Create a new entry
  await rldata.setItem(data.key, {
    start: Date.now(),
    end: Date.now() + rule.period * 1000,
    count: 1,
  })

  return {
    limited: false,
    entry,
    rule,
  }
}

export function getRouters(options: RlOptions) {
  const router = createRouter<RateLimitRule>()

  for (const [route, entry] of Object.entries(options.rules)) {
    router.insert(route, entry)
  }

  if (options.default === false) {
    return {
      router,
    }
  }

  const globalRouter = createRouter<DefaultRateLimitRule>({
    routes: {
      [options.default.route]: options.default,
    },
  })

  return {
    globalRouter,
    router,
  }
}
