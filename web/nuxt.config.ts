import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  nitro: { preset: "node" },
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || "http://localhost:4000"
    }
  },
  app: {
    head: {
      title: "Echos - Runtime"
    }
  },
  css: [
    '~/assets/css/main.css'
  ],
  vite: {
    plugins: [
      tailwindcss()
    ]
  }
})

