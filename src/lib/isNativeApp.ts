import { Capacitor } from '@capacitor/core'

/**
 * Retorna true quando a aplicação estiver rodando como APK nativo (Capacitor/TWA).
 * Retorna false quando estiver rodando no navegador web (Vercel).
 */
export function isNativeApp(): boolean {
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    return true
  }
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
    return true
  }
  if (typeof window !== 'undefined' && (window as any).isNativeApp) {
    return true
  }
  return false
}
