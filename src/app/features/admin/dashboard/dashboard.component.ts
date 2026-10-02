import { Component, OnInit, ChangeDetectorRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { Popover, PopoverModule } from 'primeng/popover';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { DockModule } from 'primeng/dock';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { EventService } from '../../../core/services/event.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { PartnerService } from '../../../core/services/partner.service';
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
    PopoverModule,
    DatePickerModule,
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [DialogService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private eventService   = inject(EventService);
  private usuarioService = inject(UsuarioService);
  private partnerService = inject(PartnerService);
  private cdr            = inject(ChangeDetectorRef);
  private dialogService  = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService      = inject(MessageService);
  private router              = inject(Router);

  // Signals reactivos de rol — el template los usa para adaptar la UI
  readonly perfil    = toSignal(this.usuarioService.perfil$, { initialValue: null });
  readonly esAdmin   = computed(() => this.perfil()?.rol === 'admin');
  readonly esPartner = computed(() => this.perfil()?.rol === 'partner');

  // Modo de vista para el Administrador (Opción B: 'directos' por defecto)
  vistaAdmin = signal<'directos' | 'todos'>('directos');

  // Filtro de equipo dentro de Directos (Opción A: 'todos' los del estudio o 'mios' creados por mí)
  filtroEquipo = signal<'todos' | 'mios'>('todos');

  // Mapa de Partner UID -> Nombre de Agencia para la vista global
  mapaPartners = new Map<string, string>();
  // Mapa de Usuario UID -> Nombre para mostrar creador
  mapaUsuarios = new Map<string, string>();

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

  // Contadores para el filtro de equipo (Opción A)
  totalDirectos = computed(() => this.eventos().length);
  totalMios = computed(() => {
    const currentUid = this.perfil()?.uid;
    if (!currentUid) return 0;
    return this.eventos().filter(
      (e) => e.ownerId === currentUid || e.creadoPorUid === currentUid,
    ).length;
  });

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
      this.terminoBusqueda().trim() !== '' ||
      (this.esAdmin() && this.vistaAdmin() === 'directos' && this.filtroEquipo() !== 'todos')
    );
  });

  // Lista de eventos computada con los filtros aplicados
  eventosFiltrados = computed(() => {
    let lista = this.eventos();

    // Filtro Opción A (Dentro de Directos: Solo los míos vs Todo el Estudio)
    if (this.esAdmin() && this.vistaAdmin() === 'directos' && this.filtroEquipo() === 'mios') {
      const currentUid = this.perfil()?.uid;
      if (currentUid) {
        lista = lista.filter((e) => e.ownerId === currentUid || e.creadoPorUid === currentUid);
      }
    }

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
    const perfil = await this.usuarioService.esperarInicializacion();
    if (perfil?.rol === 'admin') {
      try {
        const usuarios = await this.partnerService.getUsuarios();
        usuarios.forEach((u) => {
          this.mapaUsuarios.set(u.uid, u.displayName || u.email);
          if (u.rol === 'partner') {
            this.mapaPartners.set(u.uid, u.agenciaNombre || u.displayName);
          }
        });
        if (!sessionStorage.getItem('contactoPartnerRespaldado')) {
          this.partnerService
            .respaldarContactoEnEventos(usuarios)
            .then(() => sessionStorage.setItem('contactoPartnerRespaldado', '1'))
            .catch((e) => console.warn('No se pudo respaldar el contacto de partners en eventos:', e));
        }
      } catch (e) {
        console.warn('No se pudo precargar mapa de usuarios en Dashboard:', e);
      }
    }
    await this.cargarEventos();
  }

  async cambiarVistaAdmin(vista: 'directos' | 'todos') {
    if (this.vistaAdmin() === vista) return;
    this.vistaAdmin.set(vista);
    await this.cargarEventos();
  }

  async cargarEventos() {
    const rawEvents = await this.eventService.getEvents(this.vistaAdmin());
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

  getAgenciaEvento(evento: any): string {
    if (!evento.ownerId) return 'NahoFlo (Directo)';
    return this.mapaPartners.get(evento.ownerId) || 'Agencia Partner';
  }

  esEventoDirecto(evento: any): boolean {
    return !evento.ownerId || !this.mapaPartners.has(evento.ownerId);
  }

  cambiarFiltroEquipo(modo: 'todos' | 'mios', table?: Table) {
    this.filtroEquipo.set(modo);
    table?.reset();
  }

  esEventoMio(evento: any): boolean {
    const currentUid = this.perfil()?.uid;
    if (!currentUid) return false;
    return evento.ownerId === currentUid || evento.creadoPorUid === currentUid;
  }

  getCreadorEvento(evento: any): string {
    if (evento.creadoPorNombre) return evento.creadoPorNombre;
    if (evento.ownerId && this.mapaUsuarios.has(evento.ownerId)) {
      return this.mapaUsuarios.get(evento.ownerId)!;
    }
    return 'NahoFlo Studio';
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
    op?: Popover,
  ): void {
    this.filtroEstado.set(estado);
    table?.reset();
    op?.hide();
  }

  seleccionarFecha(fecha: Date | null, table?: Table, op?: Popover): void {
    this.filtroFecha.set(fecha);
    table?.reset();
    op?.hide();
  }

  limpiarTodosFiltros(table?: Table): void {
    this.filtroEstado.set('todos');
    this.filtroFecha.set(null);
    this.filtroEquipo.set('todos');
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
      width: '1000px',
      breakpoints: { '1060px': '94vw' },
      closable: true,
      draggable:false,
      focusOnShow: false,
      styleClass: 'event-form-dialog',
      data: eventoAEditar,
    });

    ref?.onClose.subscribe(async (exito: boolean) => {
      if (exito) {
        await this.cargarEventos();
      }
    });
  }

  toggleEstado(evento: any) {
    const nuevoEstado = !evento.estaActivo;
    const accion = nuevoEstado ? 'activar' : 'desactivar (pasar a borrador)';
    const titulo = nuevoEstado ? 'Activar Evento' : 'Desactivar Evento';

    this.confirmationService.confirm({
      header: titulo,
      message: `¿Estás seguro de ${accion} el evento "${evento.titulo || evento.nombreEvento}"?`,
      icon: nuevoEstado ? 'pi pi-check-circle text-emerald-500' : 'pi pi-exclamation-triangle text-amber-500',
      acceptLabel: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: nuevoEstado ? 'p-button-success' : 'p-button-warning',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        try {
          await this.eventService.updateEvent(evento.id, { estaActivo: nuevoEstado });
          await this.cargarEventos();
          this.messageService.add({
            severity: 'success',
            summary: 'Estado Actualizado',
            detail: `El evento "${evento.titulo || evento.nombreEvento}" ha sido ${nuevoEstado ? 'activado' : 'desactivado'}.`,
          });
        } catch (error) {
          console.error('Error al cambiar el estado del evento:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cambiar el estado del evento.',
          });
        }
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se realizaron cambios en el evento',
        });
      },
    });
  }

  eliminarEvento(evento: any) {
    if (!evento?.id) return;

    this.confirmationService.confirm({
      header: 'Eliminar Evento',
      message: `¿Estás seguro de eliminar permanentemente el evento "${evento.titulo || evento.nombreEvento}"? Esta acción no se puede deshacer.`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        try {
          await this.eventService.deleteEvent(evento.id);
          await this.cargarEventos();
          this.messageService.add({
            severity: 'success',
            summary: 'Evento Eliminado',
            detail: `El evento "${evento.titulo || evento.nombreEvento}" ha sido eliminado correctamente.`,
          });
        } catch (error) {
          console.error('Error al eliminar evento:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo eliminar el evento.',
          });
        }
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'Eliminación del evento cancelada',
        });
      },
    });
  }

  // Abre el modal de vista detalle con DialogService
  verDetalleEvento(evento: any) {
    const ref = this.dialogService.open(EventoDetalleModalComponent, {
      header: 'Detalle del evento',
      width: '1100px',
      breakpoints: { '1160px': '94vw' },
      closable: true,
      draggable: false,
      focusOnShow: false,
      data: evento,
    });

    ref?.onClose.subscribe((res?: { accion?: string; evento?: any }) => {
      if (res?.accion === 'editar') {
        this.openDialog(res.evento);
      }
    });
  }

  puedeAdministrar(evento: any): boolean {
    return Boolean(evento?.enlace) && (this.esAdmin() || this.esEventoMio(evento));
  }

  administrarEvento(evento: any) {
    if (!this.puedeAdministrar(evento)) return;
    void this.router.navigate(['/e', evento.enlace, 'asistencias']);
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
      closable: true,
      closeOnEscape: true,
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
