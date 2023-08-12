export default defineNuxtConfig({
  modules: ["../src/module"],
  rl: {
    enabled: true,

    // Default rate limit only to api, 1 req
    default: {
      route: "/api/**",
      limit: 10,
      period: 5,
    },
  },
  devtools: {
    enabled: true,
  },
  nitro: {},
})
