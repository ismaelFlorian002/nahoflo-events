import { Component, OnInit, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';

import { ConfirmationService, MessageService } from 'primeng/api';

import { ClienteService } from '../../../core/services/cliente.service';
import { EventService } from '../../../core/services/event.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { PartnerService } from '../../../core/services/partner.service';
import { ClienteModel } from '../../../core/models/cliente.model';
import { ClienteModalComponent } from './cliente-modal/cliente-modal.component';
import { ClienteDetalleModalComponent } from './cliente-detalle-modal/cliente-detalle-modal.component';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    DynamicDialogModule,
  ],
  providers: [DialogService],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss',
})
export class ClientesComponent implements OnInit {
  private clienteService = inject(ClienteService);
  private eventService   = inject(EventService);
  private usuarioService = inject(UsuarioService);
  private partnerService = inject(PartnerService);
  private dialogService  = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService      = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  clientes: ClienteModel[] = [];
  clientesBase: ClienteModel[] = [];
  cargando = false;

  // Estado de roles
  esAdmin   = signal(false);
  esPartner = signal(false);

  // Modo de vista para el Administrador (Opción B / A)
  vistaAdmin: 'directos' | 'todos' = 'directos';
  filtroEquipo: 'todos' | 'mios' = 'todos';

  // Mapa de Partner UID -> Nombre de Agencia para la vista global
  mapaPartners = new Map<string, string>();
  // Mapa de Usuario UID -> Nombre para mostrar creador
  mapaUsuarios = new Map<string, string>();
  currentUid: string | null = null;

  async ngOnInit() {
    const perfil = await this.usuarioService.esperarInicializacion();
    if (perfil) {
      this.currentUid = perfil.uid;
      this.esAdmin.set(perfil.rol === 'admin');
      this.esPartner.set(perfil.rol === 'partner');

      // Si es Admin, precargar el catálogo de usuarios para mapear agencias y creadores
      if (perfil.rol === 'admin') {
        try {
          const usuarios = await this.partnerService.getUsuarios();
          usuarios.forEach((u) => {
            this.mapaUsuarios.set(u.uid, u.displayName || u.email);
            if (u.rol === 'partner') {
              this.mapaPartners.set(u.uid, u.agenciaNombre || u.displayName);
            }
          });
        } catch (e) {
          console.warn('No se pudo precargar mapa de usuarios:', e);
        }
      }
    }

    await this.cargarClientes();
  }

  async cambiarVistaAdmin(vista: 'directos' | 'todos') {
    if (this.vistaAdmin === vista) return;
    this.vistaAdmin = vista;
    await this.cargarClientes();
  }

  cambiarFiltroEquipo(modo: 'todos' | 'mios') {
    this.filtroEquipo = modo;
    this.aplicarFiltroEquipo();
  }

  aplicarFiltroEquipo() {
    if (this.esAdmin() && this.vistaAdmin === 'directos' && this.filtroEquipo === 'mios') {
      this.clientes = this.clientesBase.filter((c) => this.esClienteMio(c));
    } else {
      this.clientes = [...this.clientesBase];
    }
    this.cdr.detectChanges();
  }

  get totalDirectos(): number {
    return this.clientesBase.length;
  }

  get totalMios(): number {
    return this.clientesBase.filter((c) => this.esClienteMio(c)).length;
  }

  esClienteMio(cliente: ClienteModel): boolean {
    if (!this.currentUid) return false;
    return cliente.partnerId === this.currentUid || cliente.creadoPorUid === this.currentUid;
  }

  getCreadorCliente(cliente: ClienteModel): string {
    if (cliente.creadoPorNombre) return cliente.creadoPorNombre;
    if (cliente.partnerId && this.mapaUsuarios.has(cliente.partnerId)) {
      return this.mapaUsuarios.get(cliente.partnerId)!;
    }
    return 'NahoFlo Studio';
  }

  async cargarClientes() {
    this.cargando = true;
    try {
      const [listaClientes, listaEventos] = await Promise.all([
        this.clienteService.getClientes(this.vistaAdmin),
        this.eventService.getEvents(),
      ]);

      this.clientesBase = listaClientes.map((cliente) => {
        const clienteId = cliente.id;
        const telLimpio = cliente.telefono ? String(cliente.telefono).replace(/\D/g, '') : '';
        const nomLimpio = cliente.nombreCompleto ? cliente.nombreCompleto.trim().toLowerCase() : '';

        const eventosDelCliente = listaEventos.filter((e) => {
          if (clienteId && e.clienteId === clienteId) return true;
          if (telLimpio && telLimpio.length >= 7 && e.contactoTelefono) {
            const eTel = String(e.contactoTelefono).replace(/\D/g, '');
            if (eTel.length >= 7 && (eTel.includes(telLimpio) || telLimpio.includes(eTel))) {
              return true;
            }
          }
          if (nomLimpio && e.contactoNombre) {
            const eNom = String(e.contactoNombre).trim().toLowerCase();
            if (eNom && (eNom === nomLimpio || eNom.includes(nomLimpio) || nomLimpio.includes(eNom))) {
              return true;
            }
          }
          return false;
        });

        const totalReal = eventosDelCliente.length;

        if (clienteId && cliente.totalEventos !== totalReal) {
          this.clienteService.updateCliente(clienteId, { totalEventos: totalReal }).catch(() => {});
        }

        return {
          ...cliente,
          totalEventos: totalReal,
        };
      });

      this.aplicarFiltroEquipo();
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo cargar la lista de clientes.',
      });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  getAgenciaCliente(cliente: ClienteModel): string {
    if (!cliente.partnerId) return 'NahoFlo (Directo)';
    return this.mapaPartners.get(cliente.partnerId) || 'Agencia Partner';
  }

  esClienteDirecto(cliente: ClienteModel): boolean {
    return !cliente.partnerId || !this.mapaPartners.has(cliente.partnerId);
  }

  openDialog(clienteAEditar?: ClienteModel) {
    const ref = this.dialogService.open(ClienteModalComponent, {
      header: clienteAEditar ? 'Editar cliente' : 'Registrar nuevo cliente',
      width: '640px',
      breakpoints: { '700px': '94vw' },
      closable: true,
      draggable: false,
      dismissableMask: true,
      focusOnShow: false,
      data: clienteAEditar,
    });

    ref?.onClose.subscribe(async (guardado: boolean) => {
      if (guardado) {
        await this.cargarClientes();
      }
    });
  }

  verDetalle(cliente: ClienteModel) {
    const ref = this.dialogService.open(ClienteDetalleModalComponent, {
      header: 'Expediente del cliente',
      width: '860px',
      breakpoints: { '920px': '94vw' },
      closable: true,
      draggable: false,
      dismissableMask: true,
      focusOnShow: false,
      data: cliente,
    });

    ref?.onClose.subscribe((res?: { accion?: string; cliente?: ClienteModel }) => {
      if (res?.accion === 'editar') {
        this.openDialog(res.cliente);
      }
    });
  }

  eliminarCliente(cliente: ClienteModel) {
    this.confirmationService.confirm({
      header: 'Eliminar Cliente',
      message: `¿Estás seguro de que deseas eliminar al cliente "${cliente.nombreCompleto}"?`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        if (!cliente.id) return;
        try {
          await this.clienteService.deleteCliente(cliente.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Cliente Eliminado',
            detail: `Se eliminó a ${cliente.nombreCompleto} del catálogo.`,
          });
          await this.cargarClientes();
        } catch (error) {
          console.error('Error al eliminar cliente:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo eliminar el cliente.',
          });
        }
      },
    });
  }

  getWhatsappUrl(telefono: string): string {
    if (!telefono) return '';
    const cleanNumber = telefono.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}`;
  }

  formatFecha(fecha: any): string {
    if (!fecha) return '-';
    let d: Date;
    if (typeof fecha.toDate === 'function') {
      d = fecha.toDate();
    } else if (fecha.seconds) {
      d = new Date(fecha.seconds * 1000);
    } else if (fecha instanceof Date) {
      d = fecha;
    } else {
      d = new Date(fecha);
    }
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
  }
}
