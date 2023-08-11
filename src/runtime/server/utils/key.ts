import type { H3Event } from "h3"
import { createRouter } from "radix3"
import { rllogger } from "./rl"

export interface KeyData {
  key: string
  metadata: Record<string, any>
}

export type KeyFunction = (event: H3Event) => Promise<KeyData>
export let defaultKeys: KeyFunction[] = [keyByIP]
export const keyRouter = createRouter<KeyFunction[]>()

export async function keyByIP(event: H3Event): Promise<KeyData> {
  const forwarded = event.node.req.headers["x-forwarded-for"]

  if (!forwarded) {
    rllogger.warn("Could not determine IP address.")
    return {
      key: "::",
      metadata: {
        ip: "::",
      },
    }
  }

  if (Array.isArray(forwarded)) {
    rllogger.warn("Multiple forwarded headers.")
    return {
      key: forwarded[0],
      metadata: {
        ip: forwarded[0],
      },
    }
  }

  return {
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
  const keys = routeKeys == null ? defaultKeys : routeKeys

  // Start calling the key functions
  const promises = keys.map((k) => k(e))

  // Resolve all of the promises
  const resolved = await Promise.all(promises)

  // Remove colons from output, join each key with a colon
  const key = resolved.map((x) => x.key.replaceAll(":", ".")).join(":")

  // Search through our metadata and find duplicated keys
  // Likely a faster way to do this
  const metadata: Record<string, any> = {}
  for (const resolvedItem of resolved) {
    const meta = resolvedItem.metadata
    const metaKeys = Object.keys(meta)

    for (const metaKey of metaKeys) {
      if (metaKey in metadata) {
        rllogger.warn(
          `Duplicate RL metadata key '${metaKey}'. Metadata may be inconsistent.`,
        )
      } else {
        metadata[metaKey] = meta[metaKey]
      }
    }
  }

  return {
    key,
    metadata,
  }
}

export function addKeyFunctions(path: string, ...fns: KeyFunction[]) {
  keyRouter.insert(path, fns)
}

export function useDefaultKeyFunctions(...fns: KeyFunction[]) {
  defaultKeys = fns
}

export function addDefaultKeyFunction(fn: KeyFunction) {
  defaultKeys.push(fn)
}
