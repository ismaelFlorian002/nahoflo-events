import { Component, OnInit, OnDestroy, input, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-reproductor-musica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reproductor-musica.component.html',
  styleUrl: './reproductor-musica.component.scss',
})
export class ReproductorMusicaComponent implements OnInit, OnDestroy {
  // Signal Input moderna para la URL de la música
  readonly urlMusica = input.required<string>();

  // Inyección funcional del servicio
  protected readonly servicioAudio = inject(AudioService);

  constructor() {
    effect(() => {
      const url = this.urlMusica();
      if (url) {
        this.servicioAudio.inicializar(url);
      }
    });
  }

  ngOnInit(): void {
    this.servicioAudio.reproducir();
    // Al primer toque o clic del usuario en la pantalla, inicia la reproducción respetando la política del navegador
    const reproducirPrimerGesto = () => {
      if (!this.servicioAudio.estaReproduciendo()) {
        this.servicioAudio.reproducir();
      }
      window.removeEventListener('pointerdown', reproducirPrimerGesto);
    };

    window.addEventListener('pointerdown', reproducirPrimerGesto, { once: true });
  }

  alternarMusica(): void {
    this.servicioAudio.alternar();
  }

  ngOnDestroy(): void {
    this.servicioAudio.limpiar();
  }
}
