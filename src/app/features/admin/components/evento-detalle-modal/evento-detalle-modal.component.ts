import { Component, inject, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Evento } from '../../../../core/models/event.model';

@Component({
  selector: 'app-evento-detalle-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, TooltipModule],
  templateUrl: './evento-detalle-modal.component.html',
  styleUrl: './evento-detalle-modal.component.scss',
})
export class EventoDetalleModalComponent implements OnInit, AfterViewInit {
  private elementRef = inject(ElementRef);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  @ViewChild('headerAcciones') headerAccionesRef?: ElementRef<HTMLElement>;

  evento!: Evento;
  copiadoEnlace = false;
  copiadoPin = false;

  ngOnInit(): void {
    this.evento = this.config.data;
  }

  ngAfterViewInit(): void {
    // Inserta los botones de acción fijos en la cabecera nativa de PrimeNG (a la izquierda de la 'X')
    if (this.headerAccionesRef?.nativeElement) {
      const dialogHeaderIcons = this.elementRef.nativeElement
        .closest('.p-dialog')
        ?.querySelector('.p-dialog-header-icons');
      if (dialogHeaderIcons) {
        dialogHeaderIcons.prepend(this.headerAccionesRef.nativeElement);
      }
    }
  }

  // Normaliza fecha de Firestore o string y la formatea
  formatearFechaCompleta(fecha: any): string {
    if (!fecha) return 'No definida';
    let d: Date;
    if (typeof fecha.toDate === 'function') {
      d = fecha.toDate();
    } else if (fecha.seconds !== undefined) {
      d = new Date(fecha.seconds * 1000);
    } else if (fecha instanceof Date) {
      d = fecha;
    } else if (typeof fecha === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [y, m, dia] = fecha.split('-').map(Number);
        d = new Date(y, m - 1, dia);
      } else {
        d = new Date(fecha);
      }
    } else {
      return 'No definida';
    }

    if (isNaN(d.getTime())) return 'No definida';

    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }

  // Formatea hora si existe en el objeto fecha
  formatearHora(fecha: any): string | null {
    if (!fecha) return null;
    let d: Date;
    if (typeof fecha.toDate === 'function') {
      d = fecha.toDate();
    } else if (fecha.seconds !== undefined) {
      d = new Date(fecha.seconds * 1000);
    } else if (fecha instanceof Date) {
      d = fecha;
    } else {
      d = new Date(fecha);
    }

    if (isNaN(d.getTime())) return null;

    // Si la hora es medianoche exacta (00:00:00) y solo se guardó fecha, no mostrar hora vacía
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
      return null;
    }

    return new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  obtenerUrlPublica(): string {
    if (!this.evento?.enlace) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/e/${this.evento.enlace}`;
  }

  async copiarEnlace(): Promise<void> {
    const url = this.obtenerUrlPublica();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copiadoEnlace = true;
      setTimeout(() => (this.copiadoEnlace = false), 2200);
    } catch {
      console.warn('No se pudo copiar el enlace al portapapeles');
    }
  }

  async copiarPin(): Promise<void> {
    if (!this.evento?.pinAnfitrion) return;
    try {
      await navigator.clipboard.writeText(this.evento.pinAnfitrion);
      this.copiadoPin = true;
      setTimeout(() => (this.copiadoPin = false), 2200);
    } catch {
      console.warn('No se pudo copiar el PIN');
    }
  }

  abrirInvitacion(): void {
    const url = this.obtenerUrlPublica();
    if (url) {
      window.open(url, '_blank');
    }
  }

  getWhatsappUrl(telefono?: string): string {
    if (!telefono) return '';
    const cleanNumber = telefono.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }

  cerrar(): void {
    this.ref.close();
  }

  editar(): void {
    this.ref.close({ accion: 'editar', evento: this.evento });
  }

  verAsistencias(): void {
    this.ref.close({ accion: 'asistencias', evento: this.evento });
  }

  abrirQr(): void {
    this.ref.close({ accion: 'qr', evento: this.evento });
  }
}
