import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Ajustado para '/' para garantir carregamento de assets em sub-rotas
  define: {
    // Usamos o padrão VITE_ para variáveis de ambiente injetadas
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(new Date().toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    })),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '2.0.0')
  }
})