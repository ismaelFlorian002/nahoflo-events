import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Evento } from '../../../core/models/event.model';
import { copiarAlPortapapeles } from '../../../core/utils/clipboard.util';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-mesa-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './qr-mesa-modal.component.html',
  styleUrl: './qr-mesa-modal.component.scss',
})
export class QrMesaModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  evento = signal<Evento | null>(null);
  qrDataUrl = signal<string>('');
  urlAlbum = signal<string>('');
  copiado = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    const ev = this.config.data?.evento as Evento;
    if (!ev) return;

    this.evento.set(ev);

    // 1. Construir la URL completa del álbum en vivo
    const origin = window.location.origin;
    const url = `${origin}/e/${ev.enlace}/album`;
    this.urlAlbum.set(url);

    // 2. Generar el código QR en ultra alta resolución (600x600 px) para impresión física nítida
    try {
      const qrPng = await QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: {
          dark: '#1c1917', // Color carbón elegante para máxima legibilidad de cámara
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H', // Nivel High: permite legibilidad óptima incluso con poca luz en el salón
      });
      this.qrDataUrl.set(qrPng);
    } catch (err) {
      console.error('Error generando QR de mesas:', err);
    }
  }

  async copiarEnlace(): Promise<void> {
    if (!this.urlAlbum()) return;
    await copiarAlPortapapeles(this.urlAlbum());
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2500);
  }

  imprimir(): void {
    window.print();
  }
}
