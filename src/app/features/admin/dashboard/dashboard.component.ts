import { Component, OnInit, ChangeDetectorRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { DockModule } from 'primeng/dock';
import { EventService } from '../../../core/services/event.service';
import { EventFormComponent } from '../components/event-form/event-form.component';
import { AsistenciasModalComponent } from '../components/asistencias-modal/asistencias-modal.component';
import { EventoDetalleModalComponent } from '../components/evento-detalle-modal/evento-detalle-modal.component';
import { QrMesaModalComponent } from '../../album-digital/qr-mesa-modal/qr-mesa-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    TagModule,
    DynamicDialogModule,
    DockModule,
    TooltipModule,
    OverlayPanelModule,
    CalendarModule,
  ],
  providers: [DialogService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private eventService = inject(EventService);
  private cdr = inject(ChangeDetectorRef);
  private dialogService = inject(DialogService);

  // Lista base reactiva de eventos
  eventos = signal<any[]>([]);

  // Filtros reactivos
  filtroEstado = signal<'todos' | 'activos' | 'borradores'>('todos');
  filtroFecha = signal<Date | null>(null); // Únicamente fecha, sin hora
  terminoBusqueda = signal<string>('');

  // Contadores computados
  totalEventos = computed(() => this.eventos().length);
  totalActivos = computed(() => this.eventos().filter((e) => e.estaActivo).length);
  totalBorradores = computed(() => this.eventos().filter((e) => !e.estaActivo).length);

  labelFiltroEstado = computed(() => {
    switch (this.filtroEstado()) {
      case 'activos':
        return 'Activos';
      case 'borradores':
        return 'Borradores';
      default:
        return 'Todos';
    }
  });

  conteoFiltroEstado = computed(() => {
    switch (this.filtroEstado()) {
      case 'activos':
        return String(this.totalActivos());
      case 'borradores':
        return String(this.totalBorradores());
      default:
        return String(this.totalEventos());
    }
  });

  labelFiltroFecha = computed(() => {
    const f = this.filtroFecha();
    if (!f) return 'Fecha: Todas';
    return `Fecha: ${this.formatearSoloFecha(f)}`;
  });

  hayFiltrosActivos = computed(() => {
    return (
      this.filtroEstado() !== 'todos' ||
      this.filtroFecha() !== null ||
      this.terminoBusqueda().trim() !== ''
    );
  });

  // Lista de eventos computada con los filtros aplicados
  eventosFiltrados = computed(() => {
    let lista = this.eventos();

    // 1. Filtro por Estado
    const estado = this.filtroEstado();
    if (estado === 'activos') {
      lista = lista.filter((e) => e.estaActivo);
    } else if (estado === 'borradores') {
      lista = lista.filter((e) => !e.estaActivo);
    }

    // 2. Filtro por Fecha (únicamente fecha no hora)
    const fFecha = this.filtroFecha();
    if (fFecha) {
      lista = lista.filter((e) => this.esMismoDia(e.fechaDate, fFecha));
    }

    // 3. Filtro por Búsqueda global de texto
    const query = this.terminoBusqueda().trim().toLowerCase();
    if (query) {
      lista = lista.filter(
        (e) =>
          (e.titulo || '').toLowerCase().includes(query) ||
          (e.fechaFormateada || '').toLowerCase().includes(query) ||
          (e.enlace || '').toLowerCase().includes(query) ||
          (e.contactoNombre || '').toLowerCase().includes(query) ||
          (e.contactoTelefono || '').toLowerCase().includes(query),
      );
    }

    return lista;
  });

  async ngOnInit() {
    await this.cargarEventos();
  }

  async cargarEventos() {
    const rawEvents = await this.eventService.getEvents();
    const parsedEvents = rawEvents.map((evento) => {
      const fechaDate = this.normalizarFecha(evento.fecha);
      return {
        ...evento,
        fechaDate,
        fechaTimestamp: fechaDate ? fechaDate.getTime() : 0,
        fechaFormateada: this.formatearSoloFecha(fechaDate),
      };
    });
    this.eventos.set(parsedEvents);
    this.cdr.detectChanges();
  }

  // Normaliza fecha de Firestore (Timestamp, seconds, Date o String ISO/YYYY-MM-DD)
  normalizarFecha(fecha: any): Date | null {
    if (!fecha) return null;
    if (typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    if (fecha.seconds !== undefined) {
      return new Date(fecha.seconds * 1000);
    }
    if (fecha instanceof Date) {
      return isNaN(fecha.getTime()) ? null : fecha;
    }
    if (typeof fecha === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [y, m, d] = fecha.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      const d = new Date(fecha);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // Formato elegante solo para fecha (sin hora): ej. "31 ene 2027"
  formatearSoloFecha(fecha: Date | null): string {
    if (!fecha) return '-';
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // Comparación estricta de fecha excluyendo hora, minutos y segundos
  esMismoDia(fechaA: Date | null, fechaB: Date | null): boolean {
    if (!fechaA || !fechaB) return false;
    return (
      fechaA.getFullYear() === fechaB.getFullYear() &&
      fechaA.getMonth() === fechaB.getMonth() &&
      fechaA.getDate() === fechaB.getDate()
    );
  }

  // Verifica si una fecha en el calendario contiene al menos un evento programado
  tieneEventoEnFecha(date: any): boolean {
    if (!date) return false;
    return this.eventos().some((e) => {
      const d = e.fechaDate;
      if (!d) return false;
      return (
        d.getFullYear() === date.year && d.getMonth() === date.month && d.getDate() === date.day
      );
    });
  }

  seleccionarFiltroEstado(
    estado: 'todos' | 'activos' | 'borradores',
    table?: Table,
    op?: OverlayPanel,
  ): void {
    this.filtroEstado.set(estado);
    table?.reset();
    op?.hide();
  }

  seleccionarFecha(fecha: Date | null, table?: Table, op?: OverlayPanel): void {
    this.filtroFecha.set(fecha);
    table?.reset();
    op?.hide();
  }

  limpiarTodosFiltros(table?: Table): void {
    this.filtroEstado.set('todos');
    this.filtroFecha.set(null);
    this.terminoBusqueda.set('');
    table?.reset();
  }

  onBusquedaChange(valor: string, table?: Table): void {
    this.terminoBusqueda.set(valor);
    table?.reset();
  }

  openDialog(eventoAEditar?: any) {
    const ref = this.dialogService.open(EventFormComponent, {
      header: eventoAEditar ? 'Editar Evento' : 'Crear Nuevo Evento',
      width: '1200px',
      breakpoints: { '960px': '75vw', '640px': '90vw' },
      closable: true,
      focusOnShow: false,
      data: eventoAEditar,
    });

    ref?.onClose.subscribe(async (exito: boolean) => {
      if (exito) {
        await this.cargarEventos();
      }
    });
  }

  async toggleEstado(evento: any) {
    const accion = evento.estaActivo ? 'desactivar (pasar a borrador)' : 'activar';

    if (confirm(`¿Estás seguro de ${accion} este evento?`)) {
      await this.eventService.updateEvent(evento.id, { estaActivo: !evento.estaActivo });
      await this.cargarEventos();
    }
  }

  // Abre el modal de vista detalle con DialogService
  verDetalleEvento(evento: any) {
    const ref = this.dialogService.open(EventoDetalleModalComponent, {
      header: `Detalle del Evento — ${evento.titulo || evento.nombreEvento}`,
      width: '1200px',
      breakpoints: { '960px': '75vw', '640px': '90vw' },
      closable: true,
      focusOnShow: false,
      data: evento,
    });
  }

  tieneControlInvitados(evento: any): boolean {
    if (!evento?.modulos) return true;
    return Boolean(evento.modulos.tipoControlInvitados && evento.modulos.tipoControlInvitados !== 'inactivo');
  }

  verAsistencias(evento: any) {
    if (!this.tieneControlInvitados(evento)) return;

    this.dialogService.open(AsistenciasModalComponent, {
      header: `Lista de Invitados — ${evento.titulo || evento.nombreEvento}`,
      width: '1000px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
      dismissableMask: true,
      focusOnShow: false,
      data: evento,
    });
  }

  abrirQrMesas(evento: any) {
    this.dialogService.open(QrMesaModalComponent, {
      header: `Código QR para Mesas — ${evento.titulo || evento.nombreEvento}`,
      width: '560px',
      breakpoints: { '640px': '95vw' },
      dismissableMask: true,
      focusOnShow: false,
      data: { evento },
    });
  }

  getWhatsappUrl(telefono?: string): string {
    if (!telefono) return '';
    const cleanNumber = telefono.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }
}
