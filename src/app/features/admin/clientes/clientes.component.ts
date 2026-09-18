import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  clientes: ClienteModel[] = [];
  cargando = false;

  async ngOnInit() {
    await this.cargarClientes();
  }

  async cargarClientes() {
    this.cargando = true;
    try {
      const [listaClientes, listaEventos] = await Promise.all([
        this.clienteService.getClientes(),
        this.eventService.getEvents(),
      ]);

      this.clientes = listaClientes.map((cliente) => {
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

        // Si el total almacenado en Firestore estaba desincronizado, lo actualizamos en segundo plano
        if (clienteId && cliente.totalEventos !== totalReal) {
          this.clienteService.updateCliente(clienteId, { totalEventos: totalReal }).catch(() => {});
        }

        return {
          ...cliente,
          totalEventos: totalReal,
        };
      });
    } catch (error) {
      console.error('Error al obtener la lista de clientes:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  verDetalleCliente(cliente: ClienteModel) {
    const ref = this.dialogService.open(ClienteDetalleModalComponent, {
      header: `Detalle del Cliente — ${cliente.nombreCompleto}`,
      width: '1000px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
      dismissableMask: true,
      focusOnShow: false,
      data: cliente,
    });

    ref?.onClose.subscribe(async (res: any) => {
      if (res?.accion === 'editar' && res?.cliente) {
        this.openDialog(res.cliente);
      }
    });
  }

  openDialog(clienteAEditar?: ClienteModel) {
    const ref = this.dialogService.open(ClienteModalComponent, {
      header: clienteAEditar ? `Editar Cliente — ${clienteAEditar.nombreCompleto}` : 'Nuevo Cliente',
      width: '1000px',
      breakpoints: { '640px': '95vw' },
      closable: true,
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

  eliminarCliente(cliente: ClienteModel) {
    if (!cliente.id) return;

    this.confirmationService.confirm({
      header: 'Eliminar Cliente',
      message: `¿Estás seguro de eliminar a "${cliente.nombreCompleto}" del catálogo de clientes? Esta acción no se puede deshacer.`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        try {
          await this.clienteService.deleteCliente(cliente.id!);
          await this.cargarClientes();
          this.messageService.add({
            severity: 'success',
            summary: 'Cliente Eliminado',
            detail: `"${cliente.nombreCompleto}" fue eliminado del catálogo correctamente.`,
          });
        } catch (error) {
          console.error('Error al eliminar cliente:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo eliminar el cliente.',
          });
        }
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'Eliminación del cliente cancelada',
        });
      },
    });
  }

  getWhatsappUrl(telefono?: string): string {
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
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
