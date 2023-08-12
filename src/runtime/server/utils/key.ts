import type { H3Event } from "h3"
import { createRouter } from "radix3"
import { rllogger } from "./rl"

export type KeyData =
  | {
      success: true
      fn: string
      key: string
      metadata: Record<string, any>
    }
  | {
      success: false
    }

export type KeyFunction = (event: H3Event) => Promise<KeyData>
export const keyRouter = createRouter<KeyFunction[]>()

export let fallbackKeys: KeyFunction[] = [keyByIP]

export const useRLDefaults = () => ({
  keys: {
    keyByIP,
  },
})

async function keyByIP(event: H3Event): Promise<KeyData> {
  const fn = "key_by_ip"
  const forwarded = event.node.req.headers["x-forwarded-for"]

  if (!forwarded) {
    rllogger.warn("Could not determine IP address.")

    return {
      success: false,
    }
  }

  if (Array.isArray(forwarded)) {
    rllogger.warn("Multiple forwarded headers.")
    return {
      fn,
      success: true,
      key: forwarded[0],
      metadata: {
        ip: forwarded[0],
      },
    }
  }

  return {
    fn,
    success: true,
    key: forwarded,
    metadata: {
      ip: forwarded,
    },
  }
}

export async function getKeyData(e: H3Event): Promise<KeyData> {
  // See if there are any keys for this specific route
  const routeKeys = keyRouter.lookup(e.path)

  // If there are no keys use the defaults
  const keys = routeKeys == null ? fallbackKeys : routeKeys

  // There are no key functions, we can't operate normally
  if (keys.length === 0) {
    throw new Error("No key functions found. You must have at least one key function for ratelimits to work. Try adding the default IP key function.")
  }

  // Attempt each key function until we find a winner
  for (const fn of keys) {
    const data = await fn(e)

    if (data.success) {
      return {
        fn: "",
        success: true,

        // Start with the function name to stop collisions
        // Ideally we should hash these keys to prevent collision attacks with colons
        key: data.fn + ":" + data.key.replaceAll(":", "."),
        metadata: data.metadata,
      }
    }
  }

  return {
    success: false,
  }
}

export function useKeyFunctions(path: string, ...fns: KeyFunction[]) {
  // We may need to delete the existing one?
  if (keyRouter.lookup(path)) {
    rllogger.warn(`Key functions already defined for path '${path}'`)
  }

  keyRouter.insert(path, fns)
}

export function useFallbackKeyFunctions(...fns: KeyFunction[]) {
  fallbackKeys = fns
}
