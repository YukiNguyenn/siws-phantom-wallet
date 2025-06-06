// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui-pro'],
  css: ['~/assets/css/main.css'],

  vite: {
    esbuild: {
      target: "esnext",
    },
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      include: ["@coral-xyz/anchor", "@solana/web3.js", "buffer"],
      esbuildOptions: {
        target: "esnext",
      },
    },
    define: {
      "process.env.BROWSER": true,
    },
  },

  nitro: {
    experimental: {
      websocket: true,
    },
    devProxy: {
      'host': '127.0.0.1',
      '/pre/api': {
        target: process.env.API_URL,
        prependPath: true,
        changeOrigin: true,
        // pathRewrite: {'^/api': '/api/v1'}
      },
    },
  },

  routeRules: {
    '/pre/api/**': {
      proxy: {
        to: `${process.env.API_URL}/**`,
      },
    },
  },

  runtimeConfig: {
    public: {
      baseUrl: '/pre/api',
      wsUrl: import.meta.env.WS_URL
    }
  }
})