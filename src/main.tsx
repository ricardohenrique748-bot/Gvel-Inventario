import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { SplashScreen } from '@capacitor/splash-screen'
import './index.css'
import App from './App.tsx'

registerSW({ immediate: true })

// Garante que a splash some mesmo se ocorrer erro JS durante o boot
async function boot() {
  try {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (err) {
    console.error('[boot] Erro ao renderizar o app:', err)
  } finally {
    // Esconde a splash screen independente de sucesso ou falha
    try {
      await SplashScreen.hide({ fadeOutDuration: 300 })
    } catch {
      // Ambiente web — SplashScreen não disponível, ignora
    }
  }
}

boot()
