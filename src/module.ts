import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  useLogger,
  addDevServerHandler,
  isNuxt2,
} from "@nuxt/kit"
import { objectHash } from "ohash"
import { eventHandler } from "h3"
import { defu } from "defu"
import type { Nitro } from "nitropack"
import type { BuiltinDriverName } from "unstorage"

export interface DefaultRateLimitRule extends RateLimitRule {
  route: string
}

export interface RateLimitRule {
  limit: number
  period: number
}

export interface RlOptions {
  enabled: boolean

  default: DefaultRateLimitRule | false
  rules: { [route: string]: RateLimitRule }

  driver: BuiltinDriverName
  driverOptions: any

  useAutoClear: boolean
  useDebugPage: boolean
}

export default defineNuxtModule<RlOptions>({
  meta: {
    name: "rl",
    configKey: "rl",
  },
  defaults: {
    enabled: true,
    useDebugPage: true,
    useAutoClear: false,

    default: {
      route: "/api/**",
      limit: 300,
      period: 60,
    },

    driver: "fs",
    driverOptions: {
      base: "./rl",
    },

    rules: {},
  },
  setup(options, nuxt) {
    const logger = useLogger("rl")

    if (isNuxt2()) {
      throw new Error("RL does not support nuxt2 (sorry!)")
    }

    if (!options.enabled) {
      logger.error("RL has been disabled. Rate limits will not be active.")
      return
    }

    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.rl = options as any

    addServerHandler({
      handler: resolver.resolve("./runtime/server/middleware/rl"),
    })

    // Add our debug page to development builds.
    if (nuxt.options.dev && options.useDebugPage) {
      nuxt.hook("pages:extend", (p) => {
        p.push({
          path: "/_rl",
          file: resolver.resolve("./runtime/pages/dashboard"),
        })
      })

      nuxt.hook("ready", (n) => {
        if (n.options.pages) {
          logger.info("RL Dashboard available http://localhost:3000/_rl")
        }
      })
    }

    // Configure nitro
    nuxt.hook("nitro:config", (nitroConfig) => {
      nitroConfig.storage = nitroConfig.storage ?? {}

      nitroConfig.imports = defu(nuxt.options.nitro.imports, {
        dirs: [
          resolver.resolve("./runtime/server/middleware/rl"),
          resolver.resolve("./runtime/server/pages/dashboard"),
        ],
      })

      // There is no current rl config
      if (!nitroConfig.storage.rl) {
        nitroConfig.storage.rl = nuxt.options.dev
          ? {
              driver: "fs",
              base: "./rl",
            }
          : {
              driver: options.driver,
              ...options.driverOptions,
            }
      }
    })

    if (!options.useAutoClear) {
      return
    }

    logger.warn(
      "Auto clear is enabled. This will mean changes to configuration will clear all existing rate limit information.",
    )

    // Detect if config has changed, clear and reload if so.
    nuxt.hook("nitro:init", async (nitro: Nitro) => {
      const driver = nitro.storage.getMount("rl").driver

      if (!driver.setItem || !driver.clear) {
        throw new Error(
          `Incompatible driver for RL module "${driver.name}". Driver must support setItem and clear methods.`,
        )
      }

      const config = await driver.getItem("config")
      const hash = objectHash(options)

      if (config != null && config != hash) {
        logger.warn("RL config changed, clearing database.")

        await driver.clear("data", {})
      }

      await driver.setItem("config", hash, {})
    })
  },
})
