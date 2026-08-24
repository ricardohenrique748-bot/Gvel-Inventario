import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

export const GVEL_NOTIFICATION_CHANNEL_ID = 'gvel_alertas_channel_v2'

/**
 * Cria o canal de notificações de alta prioridade no Android (necessário no Android 8+)
 */
export async function criarCanalNotificacoesAndroid() {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: GVEL_NOTIFICATION_CHANNEL_ID,
        name: 'Alertas e Avisos Gvel',
        description: 'Notificações de entrada, saída, pátio, O.S e manutenção de frota',
        importance: 5, // 5 = HIGH / MAX (mostra banner popup e vibra)
        visibility: 1, // 1 = PUBLIC
        sound: undefined,
        vibration: true,
        lights: true,
        lightColor: '#C7301F',
      })
    } catch (e) {
      console.warn('[PushNotifications] Erro ao criar canal de notificações Android:', e)
    }
  }
}

/**
 * Dispara notificações no dispositivo móvel (Barra de status do Android)
 * e também via Web Notifications API nos navegadores compatíveis.
 */
export async function solicitarPermissaoNotificacoes(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await criarCanalNotificacoesAndroid()
      const status = await LocalNotifications.checkPermissions()
      if (status.display === 'granted') return true
      const req = await LocalNotifications.requestPermissions()
      return req.display === 'granted'
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true
      if (Notification.permission === 'denied') return false
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
  } catch (e) {
    console.warn('[PushNotifications] Erro ao solicitar permissão:', e)
  }
  return false
}

export async function dispararPushLocal(titulo: string, mensagem: string, linkUrl?: string) {
  try {
    // 1. No Android / iOS nativo (APK)
    if (Capacitor.isNativePlatform()) {
      await criarCanalNotificacoesAndroid()
      let status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') {
        status = await LocalNotifications.requestPermissions()
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 900000) + 100000,
            title: titulo,
            body: mensagem,
            schedule: { at: new Date(Date.now() + 50) },
            smallIcon: 'ic_stat_notification',
            iconColor: '#C7301F',
            channelId: GVEL_NOTIFICATION_CHANNEL_ID,
            actionTypeId: '',
            extra: linkUrl ? { url: linkUrl } : null,
          },
        ],
      })
      return
    }

    // 2. No Navegador Web (Desktop / Mobile Browser / PWA)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }

      if (Notification.permission === 'granted') {
        const notifOptions: NotificationOptions = {
          body: mensagem,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `gvel_${Date.now()}_${Math.random()}`,
          data: { url: linkUrl || window.location.href },
        }

        // Tenta exibir pelo Service Worker ativo se disponível
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready
            if (reg && 'showNotification' in reg) {
              await reg.showNotification(titulo, notifOptions)
              return
            }
          } catch (swErr) {
            console.debug('[PushNotifications] Fallback de serviceWorker:', swErr)
          }
        }

        // Fallback para Notification API nativa do navegador
        const notif = new Notification(titulo, notifOptions)
        notif.onclick = () => {
          window.focus()
          notif.close()
        }
      }
    }
  } catch (e) {
    console.warn('[PushNotifications] Erro ao disparar push local:', e)
  }
}
