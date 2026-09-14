import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';

import { ClienteService } from '../../../core/services/cliente.service';
import { ClienteModel } from '../../../core/models/cliente.model';
import { ClienteModalComponent } from './cliente-modal/cliente-modal.component';

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
  private dialogService = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);

  clientes: ClienteModel[] = [];
  cargando = false;

  async ngOnInit() {
    await this.cargarClientes();
  }

  async cargarClientes() {
    this.cargando = true;
    try {
      this.clientes = await this.clienteService.getClientes();
    } catch (error) {
      console.error('Error al obtener la lista de clientes:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  openDialog(clienteAEditar?: ClienteModel) {
    const ref = this.dialogService.open(ClienteModalComponent, {
      header: clienteAEditar ? `Editar Cliente — ${clienteAEditar.nombreCompleto}` : 'Nuevo Cliente',
      width: '480px',
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

  async eliminarCliente(cliente: ClienteModel) {
    if (!cliente.id) return;

    const mensaje = `¿Estás seguro de eliminar a "${cliente.nombreCompleto}" del catálogo de clientes?`;
    if (confirm(mensaje)) {
      try {
        await this.clienteService.deleteCliente(cliente.id);
        await this.cargarClientes();
      } catch (error) {
        console.error('Error al eliminar cliente:', error);
      }
    }
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
