import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  nitro: { 
    preset: "node",
    // Ensure Nitro listens on all interfaces and uses Railway's PORT
    devServer: {
      host: '0.0.0.0'
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:4000"
    }
  },
  app: {
    head: {
      title: "Echos - Multi-Agent Runtime"
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

