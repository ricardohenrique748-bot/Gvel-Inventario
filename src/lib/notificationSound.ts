/**
 * Helper para tocar som de notificação cristalino usando Web Audio API
 * Funciona offline tanto no Navegador quanto no APK/Capacitor sem precisar carregar arquivos externos.
 */

class NotificationAudioPlayer {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          this.ctx = new AudioCtx()
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
      return this.ctx
    } catch {
      return null
    }
  }

  public playChime() {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime

      // Nota 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now)

      gain1.gain.setValueAtTime(0, now)
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.03)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.35)

      // Nota 2: 880.00 Hz (A5) com leve delay criando o som clássico de alerta
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, now + 0.08)

      gain2.gain.setValueAtTime(0, now + 0.08)
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.11)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

      osc2.connect(gain2)
      gain2.connect(ctx.destination)

      osc2.start(now + 0.08)
      osc2.stop(now + 0.6)
    } catch (e) {
      console.warn('[NotificationSound] Não foi possível reproduzir o áudio:', e)
    }
  }
}

export const notificationSound = new NotificationAudioPlayer()
