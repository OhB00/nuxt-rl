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

export const useRL = () => ({
  keys: {
    combine,
    keyByIP,
    keyByPath
  },
})

function combine(...keys: KeyFunction[]): KeyFunction {
  const fn: KeyFunction = async (e) => {

    const results = await Promise.all(keys.map(k => k(e)))
    const yes = results.filter(k => k.success)

    if (yes.length == 0) {
      return {
        success: false
      }
    }

    const metadata = {} as any
    for (const y of yes) {
      if (y.success) {

        for (const [k,v] of Object.entries(y.metadata)) {
            metadata[k] = v
        }
      }
    }

    const key = yes.map(x => x.success ? `${x.fn}:${encodeURIComponent(x.key)}` : "").join(":")

    return {
      success: true,
      fn: "combined",

      // It should always be a success
      key,
      metadata
    }
  }

 (fn as any)._dontEncode = true

  return fn
}

async function keyByPath(event: H3Event): Promise<KeyData> {
  return {
    success: true,
    fn: "key_by_path",
    key: event.path.split('?')[0],
    metadata: {}
  }
}

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
    throw new Error(
      "No key functions found. You must have at least one key function for ratelimits to work. Try adding the default IP key function.",
    )
  }

  // Attempt each key function until we find a winner
  for (const fn of keys) {
    const data = await fn(e)

    if (data.success) {

      const encodedKey = (fn as any)._dontEncode ? data.key : encodeURIComponent(data.key)

      return {
        fn: "",
        success: true,

        // Start with the function name to stop collisions
        // Need to address other collision methods
        key: `${data.fn}:${encodedKey}`,
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
