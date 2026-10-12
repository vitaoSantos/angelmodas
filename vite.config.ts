import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin'

export default defineConfig(({ mode }) => {
  // No `npm run dev`, a senha do painel vem do arquivo .env (no Netlify, das variáveis do projeto)
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD

  return {
    // O plugin do Netlify simula Functions e Blobs localmente
    // (só os recursos usados no site; os outros ficam desligados para o dev subir mais leve).
    // Redirects e arquivos estáticos ficam com o Vite: a simulação do Netlify serviria o index.html
    // antigo da pasta dist no /admin.
    plugins: [
      react(),
      tailwindcss(),
      netlify({
        edgeFunctions: { enabled: false },
        database: { enabled: false },
        images: { enabled: false },
        aiGateway: { enabled: false },
        geolocation: { enabled: false },
        redirects: { enabled: false },
        staticFiles: { enabled: false },
      }),
    ],
    build: {
      // O three.js sozinho passa do limite padrão de aviso; ele já fica num chunk separado (lazy)
      chunkSizeWarningLimit: 1200,
    },
  }
})
