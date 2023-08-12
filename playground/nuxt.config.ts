export default defineNuxtConfig({
  modules: ["../src/module"],
  rl: {
    enabled: true,

    // Default rate limit only to api, 1 req
    default: {
      route: "/**",
      limit: 10,
      period: 60,
    },
  },
  devtools: {
    enabled: true,
  },
  nitro: {},
})
