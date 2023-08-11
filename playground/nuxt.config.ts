export default defineNuxtConfig({
  modules: ["../src/module"],
  rl: {
    enabled: true,
    default: {
      route: "/**",
      limit: 60,
      period: 60,
    },
  },
  devtools: {
    enabled: true,
  },
  nitro: {},
});
