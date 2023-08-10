import { GlobalRateLimitRule, RateLimitRule, RlOptions } from "../../../module"
// @ts-ignore
import { useStorage as useStorag } from "#imports"
import { createRouter } from "radix3"
import type { H3Event } from "h3" 
 

export type GetEventKey = (event: H3Event) => Promise<string>
export type RateLimitEntry = 
{
    start: number
    end: number
    count: number
}

export type RateLimitResult = {
    limited: true
    rule: RateLimitRule
    entry: RateLimitEntry
} |  {
    limited: false
    rule: RateLimitRule | null
    entry: RateLimitEntry | null
}

export const rldata = useStorag("rl:data")

export async function isRateLimited(event: H3Event, options: RlOptions): Promise<RateLimitResult>
{
    // This is likely slow to do on every request but I don't see a better option
    const {globalRouter, router} = getRouters(options)

    // Check if this route has a specific rule
    let rule = router.lookup(event.path)

    // There is no applicable rule
    if (rule === null) {

        // If global rules have been disabled
        if (!globalRouter) {

            return {
                limited: false,
                rule: null,
                entry: null
            }
        }

        // Search if global rules apply to this route
        rule = globalRouter.lookup(event.path)

        // No global rule? Rate limits dont apply, go ham
        if (rule === null) {
            return {
                limited: false,
                rule: null,
                entry: null
            }
        }
    }

    // Remove params bit from router
    delete rule.params
    
    const key = await getKey(event)
    const entry = await rldata.getItem<RateLimitEntry>(key)

    // This client has sent a request before
    if (entry) {

        const now = new Date()
        const start = new Date(entry.start)
        const end = new Date(entry.end)
        
        if (now >= start && now <= end) 
        {
            if (++entry.count > rule.limit) 
            {
                return {
                    limited: true,
                    entry,
                    rule
                }
            }
            
            // Update the storage with the new count
            await rldata.setItem(key, entry)

            return {
                limited: false,
                entry,
                rule
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
                count: 0
            },
            rule
        }
    }

    // Create a new entry
    await rldata.setItem(key, 
    {
        start: Date.now(),
        end: Date.now() + rule.period * 1000,
        count: 1
    })

    return {
        limited: false,
        entry,
        rule
    }
}

export const keys: GetEventKey[] = [ipKey]

export async function getKey(e: H3Event): Promise<string> 
{
    const promises = keys.map(k => k(e))

    const resolved = await Promise.all(promises)

    return resolved.map(x => x.replaceAll(":", ".")).join(":")
}

export async function ipKey(event: H3Event): Promise<string>
{
    const forwarded = event.node.req.headers["x-forwarded-for"]

    if (!forwarded) 
    {
        console.warn("Could not determine IP address.")
        return "::"
    }

    if (Array.isArray(forwarded)) 
    {
        console.warn("Multiple forwarded headers.")
        return forwarded[0]
    }

    return forwarded
}

export function getRouters(options: RlOptions) {

    const router = createRouter<RateLimitRule>()

    for (const [route, entry] of Object.entries(options.rules)) 
    {
        router.insert(route, entry)   
    }

    if (options.global === false) {
        return {
            router
        }
    }
    

    const globalRouter = createRouter<GlobalRateLimitRule>(
    {
        routes: {
            [options.global.route]: options.global
        }
    })
    

    return {
        globalRouter,
        router
    }
}