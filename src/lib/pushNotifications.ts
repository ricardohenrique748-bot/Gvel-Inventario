import { LocalNotifications } from '@capacitor/local-notifications'
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

export const GVEL_NOTIFICATION_CHANNEL_ID = 'gvel_alertas_channel_v2'

/**
 * Inicializa e registra o push remoto FCM (para receber notificações com o app fechado)
 */
export async function inicializarPushRemoto(usuarioId?: string | null) {
  if (!Capacitor.isNativePlatform()) return

  try {
    await criarCanalNotificacoesAndroid()

    let permStatus = await PushNotifications.checkPermissions()
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions()
    }

    if (permStatus.receive === 'granted') {
      await PushNotifications.register()

      // Listeners
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[FCM] Token de push registrado:', token.value)
        localStorage.setItem('gvel_fcm_token', token.value)

        // Se tiver usuario logado, tenta registrar na tabela usuarios
        if (usuarioId) {
          try {
            await supabase
              .from('usuarios')
              .update({ fcm_token: token.value, updated_at: new Date().toISOString() })
              .eq('id', usuarioId)
          } catch (err) {
            console.debug('[FCM] Info: fcm_token salvo localmente:', err)
          }
        }
      })

      PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('[FCM] Erro no registro de push:', error)
      })

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[FCM] Push recebido em foreground:', notification)
      })

      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('[FCM] Notificação clicada:', notification)
        const url = notification.notification.data?.url
        if (url && typeof window !== 'undefined') {
          window.location.href = url
        }
      })
    }
  } catch (e) {
    console.warn('[FCM] Erro ao inicializar push remoto:', e)
  }
}

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

        // Tenta exibir pelo Service Worker ativo se disponível sem travar a execução
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          try {
            const reg = await navigator.serviceWorker.getRegistration()
            if (reg && typeof reg.showNotification === 'function') {
              await reg.showNotification(titulo, notifOptions)
              return
            }
          } catch (swErr) {
            console.debug('[PushNotifications] Fallback para Notification direta:', swErr)
          }
        }

        // Fallback direto para Notification API nativa do navegador
        try {
          const notif = new Notification(titulo, notifOptions)
          notif.onclick = () => {
            window.focus()
            notif.close()
          }
        } catch (notifErr) {
          console.debug('[PushNotifications] Erro Notification API:', notifErr)
        }
      }
    }
  } catch (e) {
    console.warn('[PushNotifications] Erro ao disparar push local:', e)
  }
}
