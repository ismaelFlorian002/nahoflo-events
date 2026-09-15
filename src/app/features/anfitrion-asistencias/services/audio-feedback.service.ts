import { Injectable } from '@angular/core';

export type AudioFeedbackType = 'exito' | 'alerta';

/**
 * Servicio encargado de generar retroalimentación auditiva sintética (Web Audio API)
 * para la recepción de invitados (éxito en check-in o alertas por duplicado/inválido).
 * No depende del DOM ni de librerías externas.
 */
@Injectable({
  providedIn: 'root',
})
export class AudioFeedbackService {
  private audioContext: AudioContext | null = null;

  /**
   * Obtiene o inicializa de forma segura la instancia de AudioContext respetando
   * las políticas de autoplay de los navegadores móviles y de escritorio.
   */
  private obtenerAudioContext(): AudioContext | null {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      return this.audioContext;
    } catch {
      return null;
    }
  }

  /**
   * Sintetizador de audio nativo:
   * - 'exito': Doble tono ascendente tipo "ding-ding" (587.33Hz -> 880Hz).
   * - 'alerta': Tono grave de advertencia (220Hz).
   */
  reproducirSonido(tipo: AudioFeedbackType): void {
    try {
      const ctx = this.obtenerAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (tipo === 'exito') {
        // Doble tono ascendente tipo "ding-ding"
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Tono grave de alerta
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Si el navegador bloquea el audio sin interacción previa, no interrumpe el flujo
    }
  }
}
