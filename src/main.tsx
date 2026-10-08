import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

if (Capacitor.isNativePlatform()) {
  // No APK os arquivos já vêm dentro do app: o service worker do PWA só
  // atrapalhava, servindo a versão antiga do cache mesmo depois de instalar
  // um APK novo. Remove o que ficou registrado de versões anteriores.
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
  if ('caches' in window) caches.keys().then((chaves) => chaves.forEach((c) => caches.delete(c)))
} else {
  registerSW({ immediate: true })
}

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
