import { isRateLimited } from "../utils/rl"
import { RlOptions } from "../../../module"

export default defineEventHandler(async (event) => {
  const options = useRuntimeConfig().rl as RlOptions
  const result = await isRateLimited(event, options)

  if (result.limited) {
    const seconds = (result.entry.end - Date.now()) / 1000

    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Please try again in ${seconds} seconds.`,
    })
  }
})
