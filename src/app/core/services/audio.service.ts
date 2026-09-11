import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private elementoAudio: HTMLAudioElement | null = null;

  // Signals reactivas de estado
  readonly estaReproduciendo = signal<boolean>(false);
  readonly estaCargando = signal<boolean>(false);
  readonly errorAudio = signal<string | null>(null);

  /**
   * Inicializa la pista de audio sin forzar reproducción automática invasiva
   */
  inicializar(urlMusica: string): void {
    if (!urlMusica) return;

    // Si ya existe una instancia previa, la limpiamos primero
    this.limpiar();

    this.estaCargando.set(true);
    this.errorAudio.set(null);

    this.elementoAudio = new Audio(urlMusica);
    this.elementoAudio.loop = true;
    this.elementoAudio.preload = 'auto';

    this.elementoAudio.oncanplaythrough = () => {
      this.estaCargando.set(false);
    };

    this.elementoAudio.onerror = () => {
      this.estaCargando.set(false);
      this.estaReproduciendo.set(false);
      this.errorAudio.set('No se pudo cargar la pista de música.');
    };

    this.elementoAudio.onended = () => {
      this.estaReproduciendo.set(false);
    };
    this.reproducir();
  }

  /**
   * Intenta reproducir el audio gestionando la política de autoplay del navegador
   */
  async reproducir(): Promise<boolean> {
    if (!this.elementoAudio) return false;

    try {
      await this.elementoAudio.play();
      this.estaReproduciendo.set(true);
      return true;
    } catch {
      // Los navegadores bloquean el autoplay si el usuario no ha interactuado
      this.estaReproduciendo.set(false);
      return false;
    }
  }

  /**
   * Pausa la reproducción
   */
  pausar(): void {
    if (this.elementoAudio && !this.elementoAudio.paused) {
      this.elementoAudio.pause();
      this.estaReproduciendo.set(false);
    }
  }

  /**
   * Alterna entre reproducir y pausar
   */
  alternar(): void {
    if (this.estaReproduciendo()) {
      this.pausar();
    } else {
      this.reproducir();
    }
  }

  /**
   * Detiene el audio y libera memoria
   */
  limpiar(): void {
    if (this.elementoAudio) {
      this.elementoAudio.pause();
      this.elementoAudio.src = '';
      this.elementoAudio.load();
      this.elementoAudio = null;
    }
    this.estaReproduciendo.set(false);
    this.estaCargando.set(false);
    this.errorAudio.set(null);
  }


}
