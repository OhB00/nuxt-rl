export default defineNuxtConfig({
  modules: ['../src/module'],
  rl: {
    enabled: true,
    global: {
      route: "/**",
      limit: 60,
      period: 60
    }
  },
  devtools: { enabled: true },
  nitro: {}
})
