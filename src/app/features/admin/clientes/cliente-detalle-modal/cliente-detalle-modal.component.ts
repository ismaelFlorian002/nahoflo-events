import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { ClienteModel } from '../../../../core/models/cliente.model';
import { Evento } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
// import { ClipboardModule } from '@angular/cdk/clipboard';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { A11yModule } from '@angular/cdk/a11y';

@Component({
  selector: 'app-cliente-detalle-modal',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    ClipboardModule,
    A11yModule,
  ],
  templateUrl: './cliente-detalle-modal.component.html',
  styleUrl: './cliente-detalle-modal.component.scss',
})
export class ClienteDetalleModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private eventService = inject(EventService);
  private clipboard = inject(Clipboard);
  private cdr = inject(ChangeDetectorRef);

  cliente!: ClienteModel;
  eventosAsociados: Evento[] = [];
  cargandoEventos = true;

  copiadoId = false;
  copiadoTelefono = false;
  copiadoEmail = false;

  async ngOnInit(): Promise<void> {
    this.cliente = this.config.data || {};
    this.cdr.detectChanges();
    await this.cargarEventosCliente();
  }

  async cargarEventosCliente(): Promise<void> {
    this.cargandoEventos = true;
    this.cdr.detectChanges();
    try {
      this.eventosAsociados = await this.eventService.getEventsByCliente(
        this.cliente?.id,
        this.cliente?.telefono,
        this.cliente?.nombreCompleto,
      );
    } catch (error) {
      console.error('Error al cargar eventos del cliente:', error);
      this.eventosAsociados = [];
    } finally {
      this.cargandoEventos = false;
      this.cdr.detectChanges();
    }
  }

  copiarDato(texto: string | undefined, tipo: 'id' | 'telefono' | 'email'): void {
    if (!texto) return;
    const copiadoExitoso = this.clipboard.copy(texto);
    if (!copiadoExitoso) return;

    if (tipo === 'id') {
      this.copiadoId = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiadoId = false;
        this.cdr.detectChanges();
      }, 2000);
    } else if (tipo === 'telefono') {
      this.copiadoTelefono = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiadoTelefono = false;
        this.cdr.detectChanges();
      }, 2000);
    } else if (tipo === 'email') {
      this.copiadoEmail = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiadoEmail = false;
        this.cdr.detectChanges();
      }, 2000);
    }
  }

  getIniciales(nombre?: string): string {
    if (!nombre) return 'CL';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  getWhatsappUrl(telefono?: string): string {
    if (!telefono) return '';
    const cleanNumber = telefono.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }

  formatFecha(fecha: any): string {
    if (!fecha) return 'No registrada';
    let d: Date;
    if (typeof fecha?.toDate === 'function') {
      d = fecha.toDate();
    } else if (fecha?.seconds !== undefined) {
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
      return 'No registrada';
    }

    if (isNaN(d.getTime())) return 'No registrada';

    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }

  obtenerUrlPublica(evento: Evento): string {
    if (!evento?.enlace) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/e/${evento.enlace}`;
  }

  abrirInvitacion(evento: Evento): void {
    const url = this.obtenerUrlPublica(evento);
    if (url) {
      window.open(url, '_blank');
    }
  }

  editar(): void {
    this.ref.close({ accion: 'editar', cliente: this.cliente });
  }

  cerrar(): void {
    this.ref.close();
  }
}
