import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        },
        '/uploads': {
          target,
          changeOrigin: true,
          secure: false
        }
          ,
          '/sitemap.xml': {
            target,
            changeOrigin: true,
            secure: false
            },
          '/general-knowledge/sitemap.xml': {
            target,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/general-knowledge\/sitemap.xml/, '/general-knowledge/sitemap.xml')
          },
          '/currentaffairs/sitemap.xml': {
            target,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/currentaffairs\/sitemap.xml/, '/currentaffairs/sitemap.xml')
          }
      }
    }
  }
})
