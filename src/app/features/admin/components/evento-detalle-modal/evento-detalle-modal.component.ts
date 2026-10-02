import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Router } from '@angular/router';
import { Evento } from '../../../../core/models/event.model';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { puedeAdministrarSinPin } from '../../../anfitrion-asistencias/portal-access';

interface ServicioResumen {
  titulo: string;
  detalle: string;
  icono: string;
  activo: boolean;
}

const ETIQUETAS_CONTROL_INVITADOS: Record<string, string> = {
  total: 'Pases QR y escáner',
  basico: 'Confirmación RSVP',
  lista_puerta: 'Lista en puerta',
};

@Component({
  selector: 'app-evento-detalle-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, TagModule],
  templateUrl: './evento-detalle-modal.component.html',
  styleUrl: './evento-detalle-modal.component.scss',
})
export class EventoDetalleModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);

  evento!: Evento;
  copiadoEnlace = false;
  copiadoPin = false;
  puedeAdministrar = false;
  servicios: ServicioResumen[] = [];
  serviciosActivos = 0;
  diasRestantes: number | null = null;

  ngOnInit(): void {
    this.evento = this.config.data;
    this.puedeAdministrar =
      Boolean(this.evento?.enlace) && puedeAdministrarSinPin(this.usuarioService.getPerfilActual(), this.evento);
    this.servicios = this.construirServicios();
    this.serviciosActivos = this.servicios.filter((s) => s.activo).length;
    this.diasRestantes = this.calcularDiasRestantes(this.evento?.fecha);
  }

  private construirServicios(): ServicioResumen[] {
    const m = this.evento?.modulos;
    const control = m?.tipoControlInvitados;
    const controlActivo = !!control && control !== 'inactivo';
    return [
      {
        titulo: 'Invitación web',
        detalle: !m || m.tieneInvitacion ? 'Habilitada' : 'Inactiva',
        icono: 'pi pi-globe',
        activo: !m || m.tieneInvitacion,
      },
      {
        titulo: 'Invitados',
        detalle: controlActivo ? ETIQUETAS_CONTROL_INVITADOS[control] ?? 'Activo' : 'Inactivo',
        icono: 'pi pi-users',
        activo: controlActivo,
      },
      {
        titulo: 'Álbum digital',
        detalle: !m || m.tieneAlbum ? 'Habilitado' : 'Inactivo',
        icono: 'pi pi-camera',
        activo: !m || m.tieneAlbum,
      },
      {
        titulo: 'Música de fondo',
        detalle: this.evento?.musicaFondoUrl ? 'Configurada' : 'Sin audio',
        icono: 'pi pi-volume-up',
        activo: !!this.evento?.musicaFondoUrl,
      },
      {
        titulo: 'Suite Planner',
        detalle: m?.tienePlannerSuite ? 'Habilitada' : 'Inactiva',
        icono: 'pi pi-briefcase',
        activo: !!m?.tienePlannerSuite,
      },
      {
        titulo: 'Marca blanca',
        detalle: m?.permiteMarcaBlanca ? 'Habilitada' : 'Inactiva',
        icono: 'pi pi-palette',
        activo: !!m?.permiteMarcaBlanca,
      },
    ];
  }

  // Normaliza Timestamp de Firestore, Date o string a Date
  private aFecha(fecha: any): Date | null {
    if (!fecha) return null;
    let d: Date;
    if (typeof fecha.toDate === 'function') {
      d = fecha.toDate();
    } else if (fecha.seconds !== undefined) {
      d = new Date(fecha.seconds * 1000);
    } else if (fecha instanceof Date) {
      d = fecha;
    } else if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [y, m, dia] = fecha.split('-').map(Number);
      d = new Date(y, m - 1, dia);
    } else {
      d = new Date(fecha);
    }
    return isNaN(d.getTime()) ? null : d;
  }

  private calcularDiasRestantes(fecha: any): number | null {
    const d = this.aFecha(fecha);
    if (!d) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dia = new Date(d);
    dia.setHours(0, 0, 0, 0);
    return Math.round((dia.getTime() - hoy.getTime()) / 86_400_000);
  }

  formatearFechaCompleta(fecha: any): string {
    const d = this.aFecha(fecha);
    if (!d) return 'No definida';
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }

  // Si solo se guardó fecha (00:00:00) no hay hora que mostrar
  formatearHora(fecha: any): string | null {
    const d = this.aFecha(fecha);
    if (!d) return null;
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

  administrar(): void {
    if (!this.puedeAdministrar) return;
    this.ref.close();
    void this.router.navigate(['/e', this.evento.enlace, 'asistencias']);
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
