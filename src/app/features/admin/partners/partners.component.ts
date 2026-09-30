import { Component, OnInit, inject, ChangeDetectorRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { CalendarModule } from 'primeng/calendar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { PartnerService } from '../../../core/services/partner.service';
import { UsuarioModel } from '../../../core/models/usuario.model';
import { PartnerModalComponent } from './partner-modal/partner-modal.component';

@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    DynamicDialogModule,
    OverlayPanelModule,
    CalendarModule,
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [DialogService],
  templateUrl: './partners.component.html',
  styleUrl: './partners.component.scss',
})
export class PartnersComponent implements OnInit {
  private partnerService = inject(PartnerService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  // Lista base reactiva de usuarios
  usuarios = signal<any[]>([]);
  cargando = signal<boolean>(false);

  // Filtros reactivos
  filtroEstado = signal<'todos' | 'activos' | 'inactivos'>('todos');
  filtroRol = signal<'todos' | 'admin' | 'partner'>('todos');
  filtroFecha = signal<Date | null>(null);
  terminoBusqueda = signal<string>('');

  // Contadores computados
  totalUsuarios = computed(() => this.usuarios().length);
  totalActivos = computed(() => this.usuarios().filter((u) => u.estaActivo).length);
  totalInactivos = computed(() => this.usuarios().filter((u) => !u.estaActivo).length);
  totalAdmins = computed(() => this.usuarios().filter((u) => u.rol === 'admin').length);
  totalPartners = computed(() => this.usuarios().filter((u) => u.rol === 'partner').length);

  labelFiltroEstado = computed(() => {
    switch (this.filtroEstado()) {
      case 'activos':
        return 'Activos';
      case 'inactivos':
        return 'Inactivos';
      default:
        return 'Todos';
    }
  });

  conteoFiltroEstado = computed(() => {
    switch (this.filtroEstado()) {
      case 'activos':
        return String(this.totalActivos());
      case 'inactivos':
        return String(this.totalInactivos());
      default:
        return String(this.totalUsuarios());
    }
  });

  labelFiltroRol = computed(() => {
    switch (this.filtroRol()) {
      case 'admin':
        return 'Admins';
      case 'partner':
        return 'Partners';
      default:
        return 'Todos';
    }
  });

  conteoFiltroRol = computed(() => {
    switch (this.filtroRol()) {
      case 'admin':
        return String(this.totalAdmins());
      case 'partner':
        return String(this.totalPartners());
      default:
        return String(this.totalUsuarios());
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
      this.filtroRol() !== 'todos' ||
      this.filtroFecha() !== null ||
      this.terminoBusqueda().trim() !== ''
    );
  });

  // Lista de usuarios computada con todos los filtros aplicados
  usuariosFiltrados = computed(() => {
    let lista = this.usuarios();

    // 1. Filtro por Estado
    const estado = this.filtroEstado();
    if (estado === 'activos') {
      lista = lista.filter((u) => u.estaActivo);
    } else if (estado === 'inactivos') {
      lista = lista.filter((u) => !u.estaActivo);
    }

    // 2. Filtro por Rol
    const rol = this.filtroRol();
    if (rol === 'admin') {
      lista = lista.filter((u) => u.rol === 'admin');
    } else if (rol === 'partner') {
      lista = lista.filter((u) => u.rol === 'partner');
    }

    // 3. Filtro por Fecha de Registro
    const fFecha = this.filtroFecha();
    if (fFecha) {
      lista = lista.filter((u) => this.esMismoDia(u.fechaDate, fFecha));
    }

    // 4. Filtro por Búsqueda global de texto
    const query = this.terminoBusqueda().trim().toLowerCase();
    if (query) {
      lista = lista.filter(
        (u) =>
          (u.displayName || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query) ||
          (u.rol || '').toLowerCase().includes(query) ||
          (u.agenciaNombre || '').toLowerCase().includes(query) ||
          (u.agenciaTelefono || '').toLowerCase().includes(query) ||
          (u.fechaFormateada || '').toLowerCase().includes(query),
      );
    }

    return lista;
  });

  async ngOnInit() {
    await this.cargarPartners();
  }

  async cargarPartners() {
    this.cargando.set(true);
    try {
      const rawUsuarios = await this.partnerService.getUsuarios();
      const parsedUsuarios = rawUsuarios.map((usuario) => {
        const fechaDate = this.normalizarFecha(usuario.creadoEn);
        return {
          ...usuario,
          fechaDate,
          fechaTimestamp: fechaDate ? fechaDate.getTime() : 0,
          fechaFormateada: this.formatearSoloFecha(fechaDate),
        };
      });
      this.usuarios.set(parsedUsuarios);
    } catch (error) {
      console.error('Error al cargar lista de usuarios:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar la lista de usuarios.',
      });
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
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

  // Formato de fecha uniforme: ej. "29 sep 2026"
  formatearSoloFecha(fecha: Date | null): string {
    if (!fecha) return '-';
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // Comparación estricta de fecha excluyendo hora
  esMismoDia(fechaA: Date | null, fechaB: Date | null): boolean {
    if (!fechaA || !fechaB) return false;
    return (
      fechaA.getFullYear() === fechaB.getFullYear() &&
      fechaA.getMonth() === fechaB.getMonth() &&
      fechaA.getDate() === fechaB.getDate()
    );
  }

  // Verifica si una fecha en el calendario contiene al menos un usuario registrado
  tieneUsuarioEnFecha(date: any): boolean {
    if (!date) return false;
    return this.usuarios().some((u) => {
      const d = u.fechaDate;
      if (!d) return false;
      return (
        d.getFullYear() === date.year && d.getMonth() === date.month && d.getDate() === date.day
      );
    });
  }

  seleccionarFiltroEstado(
    estado: 'todos' | 'activos' | 'inactivos',
    table?: Table,
    op?: OverlayPanel,
  ): void {
    this.filtroEstado.set(estado);
    table?.reset();
    op?.hide();
  }

  seleccionarFiltroRol(
    rol: 'todos' | 'admin' | 'partner',
    table?: Table,
    op?: OverlayPanel,
  ): void {
    this.filtroRol.set(rol);
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
    this.filtroRol.set('todos');
    this.filtroFecha.set(null);
    this.terminoBusqueda.set('');
    table?.reset();
  }

  onBusquedaChange(valor: string, table?: Table): void {
    this.terminoBusqueda.set(valor);
    table?.reset();
  }

  openDialog(usuarioAEditar?: UsuarioModel) {
    const ref = this.dialogService.open(PartnerModalComponent, {
      header: usuarioAEditar
        ? `Editar Usuario — ${usuarioAEditar.displayName}`
        : 'Registrar Nuevo Usuario',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
      dismissableMask: true,
      focusOnShow: false,
      data: usuarioAEditar,
    });

    ref?.onClose.subscribe(async (guardado: boolean) => {
      if (guardado) {
        await this.cargarPartners();
      }
    });
  }

  toggleEstado(usuario: UsuarioModel) {
    const nuevoEstado = !usuario.estaActivo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';

    this.confirmationService.confirm({
      header: `${nuevoEstado ? 'Activar' : 'Desactivar'} Cuenta`,
      message: `¿Deseas ${accion} la cuenta de "${usuario.displayName}" (Rol: ${usuario.rol.toUpperCase()})? ${
        !nuevoEstado
          ? 'El usuario no podrá acceder al sistema mientras su cuenta esté inactiva.'
          : 'El usuario podrá volver a ingresar al sistema normalmente.'
      }`,
      icon: nuevoEstado
        ? 'pi pi-check-circle text-emerald-500'
        : 'pi pi-exclamation-triangle text-amber-500',
      acceptLabel: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: nuevoEstado
        ? 'p-button-success'
        : 'p-button-warning',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        try {
          await this.partnerService.toggleEstadoUsuario(usuario.uid, nuevoEstado);
          usuario.estaActivo = nuevoEstado;
          // Actualizamos la señal reactiva
          this.usuarios.update((users) =>
            users.map((u) => (u.uid === usuario.uid ? { ...u, estaActivo: nuevoEstado } : u)),
          );
          this.cdr.detectChanges();

          this.messageService.add({
            severity: 'success',
            summary: `Cuenta ${nuevoEstado ? 'Activada' : 'Desactivada'}`,
            detail: `La cuenta de "${usuario.displayName}" ahora está ${
              nuevoEstado ? 'activa' : 'inactiva'
            }.`,
          });
        } catch (error) {
          console.error('Error al cambiar estado del usuario:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar el estado de la cuenta.',
          });
        }
      },
    });
  }

  getWhatsappUrl(telefono?: string): string {
    if (!telefono) return '';
    const cleanNumber = telefono.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }
}
