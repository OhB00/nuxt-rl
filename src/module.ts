import { defineNuxtModule, createResolver, addServerHandler, useLogger, addDevServerHandler} from '@nuxt/kit'
import type { BuiltinDriverName } from "unstorage"
import { objectHash } from "ohash"
import { eventHandler } from 'h3'
import type { Nitro } from "nitropack"

export interface GlobalRateLimitRule extends RateLimitRule 
{
  route: string
}

export interface RateLimitRule 
{
  limit: number
  period: number
}


export interface RlOptions {
  enabled: boolean,

  global: GlobalRateLimitRule | false
  rules: { [route: string]: RateLimitRule },

  driver: BuiltinDriverName,
  driverOptions: any
}

export default defineNuxtModule<RlOptions>({
  meta: {
    name: 'rl',
    configKey: 'rl'
  },
  defaults: {
    enabled: true,

    global: {
      route: "/api/**",
      limit: 300,
      period: 60
    },

    driver: "fs",
    driverOptions: {
      base: "./rl"
    },

    rules: {
      "/api/**": {
        limit: 60,
        period: 60
      }
    }

  },
  setup (options, nuxt) {

    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.rl = options as any

    addDevServerHandler({
      route: "/_rl",
      handler: eventHandler((e) => 
      {
        return `
          <html>
            <head>
            </head>
            <body>
              <h1>RL Debug Page</h1>
              <ul>
                <li>Enabled: ${options.enabled}</li>
                <li>Global Rule: ${options.global === false ? "OFF" : "ON"}</li>
                <li>Rule Count: ${Object.values(options.rules).length}</li>
                <li>Driver: ${encodeURI(options.driver)}</li>
              </ul>

              ${
                options.global !== false ? 
                `
                <h1>Global Rule</h1>
                <ul><li>${options.global.route}: ${options.global.limit} requests per ${options.global.limit} seconds</li></ul>
                ` : ""
              }


              <h1>Rules</h1>
              <ul>
                ${Object.entries(options.rules).map(([path, rule]) => `<li>${path}: ${rule.limit} requests per ${rule.period} seconds</li>`)}
              </ul>
            </body>
          </html>
        `
      })
    })


    if (options.enabled) 
    {      
      addServerHandler({
        handler: resolver.resolve('./runtime/server/middleware/rl'),
      })

      nuxt.hook('nitro:init', async (nitro: Nitro) =>
      {
        const driver = nitro.storage.getMount("rl").driver

        if (!driver.setItem || !driver.clear) {
          throw new Error(`Incompatible driver for RL module "${driver.name}". Driver must support setItem and clear methods.`)
        }

        const config = await driver.getItem("config")
        const hash = objectHash(options)

        if (config != null && config != hash) 
        {
            useLogger("rl").warn("RL config changed, clearing database.")

            await driver.clear("data", {})
        }
        
        await driver.setItem("config", hash, {})
      })


      nuxt.hook('nitro:config', (nitroConfig) => 
      {
        nitroConfig.storage = nitroConfig.storage ?? {}

        // There is no current rl config
        if (!nitroConfig.storage.rl) 
        {
            nitroConfig.storage.rl = nuxt.options.dev ? 
            {
              driver: "fs",
              base: "./rl"
            } : {
              driver: "memory",
            }
        }
      })

    }
  }
})
