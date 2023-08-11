//@ts-ignore
import jwt from "jsonwebtoken"

import type { verify as v, sign as s, decode as d } from "jsonwebtoken"
import { defineEventHandler, readBody, setCookie } from "#imports"
export const {
  verify,
  sign,
  decode,
}: { verify: typeof v; sign: typeof s; decode: typeof d } = jwt

export default defineEventHandler(async (e) => {
  const body = await readBody<{ username: string; password: string }>(e)

  const signed = sign({ username: body.username }, "bleh", {
    algorithm: "HS512",
  })

  setCookie(e, "auth", signed)

  return {
    success: true,
  }
})
