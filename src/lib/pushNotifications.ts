import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

/**
 * Dispara notificações no dispositivo móvel (Barra de status do Android)
 * e também via Web Notifications API nos navegadores compatíveis.
 */
export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.requestPermissions()
      return status.display === 'granted'
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
  } catch (e) {
    console.warn('[PushNotifications] Erro ao solicitar permissão:', e)
  }
  return false
}

export async function dispararPushLocal(titulo: string, mensagem: string) {
  try {
    // 1. No Android / iOS nativo
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions()
        if (req.display !== 'granted') return
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            title: titulo,
            body: mensagem,
            schedule: { at: new Date(Date.now() + 200) },
            smallIcon: 'ic_stat_notification',
            iconColor: '#C7301F',
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: null,
          },
        ],
      })
      return
    }

    // 2. No Navegador Web
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(titulo, {
          body: mensagem,
          icon: '/favicon.ico',
        })
      }
    }
  } catch (e) {
    console.warn('[PushNotifications] Erro ao disparar push local:', e)
  }
}
