import { KeyData } from "../../../src/runtime/server/utils/key"
import { verify } from "../api/login"
import type { H3Event } from "h3"

export default defineNitroPlugin((nitroApp) => {


    const rl = useRL()
    
    useFallbackKeyFunctions(rl.keys.combine(keyByAuth, rl.keys.keyByPath))

    addCustomRule("/", async (e, data, rule) => {
        
        return rule
    })

})


async function keyByAuth(e: H3Event): Promise<KeyData> {

    const cookie = getCookie(e, 'auth')

    if (!cookie) {
        return {
            success: false
        }
    }

    const username = (verify(cookie, "bleh") as any).username
    
    return {
        success: true,
        fn: "jwt_key",
        key: username,
        metadata: {
            id: username
        }
    }
    
}