import { Injectable, OnDestroy } from '@angular/core';

export type AudioFeedbackKind = 'success' | 'error';

export interface AudioToneStep {
  frequencyHz: number;
  offsetSeconds: number;
}

export interface AudioFeedbackConfig {
  tones: readonly AudioToneStep[];
  initialGain: number;
  durationSeconds: number;
  oscillatorType?: OscillatorType;
}

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

@Injectable({
  providedIn: 'root',
})
export class AudioFeedbackService implements OnDestroy {
  private readonly defaultSuccessConfig: AudioFeedbackConfig = {
    tones: [
      { frequencyHz: 587.33, offsetSeconds: 0 },
      { frequencyHz: 880, offsetSeconds: 0.1 },
    ],
    initialGain: 0.3,
    durationSeconds: 0.35,
    oscillatorType: 'sine',
  };

  private readonly defaultErrorConfig: AudioFeedbackConfig = {
    tones: [{ frequencyHz: 220, offsetSeconds: 0 }],
    initialGain: 0.4,
    durationSeconds: 0.3,
    oscillatorType: 'sine',
  };

  private audioContext: AudioContext | null = null;

  async playSuccessSound(config: Partial<AudioFeedbackConfig> = {}): Promise<void> {
    await this.playSound({
      ...this.defaultSuccessConfig,
      ...config,
      tones: config.tones ?? this.defaultSuccessConfig.tones,
    });
  }

  async playErrorSound(config: Partial<AudioFeedbackConfig> = {}): Promise<void> {
    await this.playSound({
      ...this.defaultErrorConfig,
      ...config,
      tones: config.tones ?? this.defaultErrorConfig.tones,
    });
  }

  async playSound(config: AudioFeedbackConfig): Promise<void> {
    try {
      const context = this.getAudioContext();

      if (context.state === 'suspended') {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = config.oscillatorType ?? 'sine';
      oscillator.connect(gain);
      gain.connect(context.destination);

      for (const tone of config.tones) {
        oscillator.frequency.setValueAtTime(
          tone.frequencyHz,
          context.currentTime + tone.offsetSeconds,
        );
      }

      gain.gain.setValueAtTime(config.initialGain, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + config.durationSeconds);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + config.durationSeconds);

      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // El navegador puede bloquear audio si aún no hubo interacción del usuario.
    }
  }

  async ngOnDestroy(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      return;
    }

    await this.audioContext.close();
    this.audioContext = null;
  }

  private getAudioContext(): AudioContext {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    const AudioContextConstructor =
      window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }
}
