import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Evento, ProveedorEvento } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { ProveedorModalComponent } from '../proveedor-modal/proveedor-modal.component';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';

@Component({
  selector: 'app-proveedores-directorio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    OverlayPanelModule,
    TooltipModule,
    BadgeModule,
  ],
  templateUrl: './proveedores-directorio.component.html',
  styleUrl: './proveedores-directorio.component.scss',
})
export class ProveedoresDirectorioComponent {
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  evento = input.required<Evento>();
  eventoActualizado = output<Evento>();

  categoriaSeleccionada = signal<string>('todas');
  busqueda = signal<string>('');

  proveedores = computed<ProveedorEvento[]>(() => this.evento().proveedores || []);

  proveedoresFiltrados = computed(() => {
    let lista = this.proveedores();
    const cat = this.categoriaSeleccionada();
    const q = this.busqueda().trim().toLowerCase();

    if (cat !== 'todas') {
      lista = lista.filter((p) => p.categoria === cat);
    }

    if (q) {
      lista = lista.filter(
        (p) =>
          p.empresa.toLowerCase().includes(q) ||
          (p.contactoNombre && p.contactoNombre.toLowerCase().includes(q)) ||
          (p.notas && p.notas.toLowerCase().includes(q)),
      );
    }

    return lista;
  });

  categoriasFiltro = [
    { label: 'Todas las Categorías', value: 'todas' },
    { label: '🎧 DJ & Audio', value: 'DJ & Audio' },
    { label: '🍷 Banquete', value: 'Banquete' },
    { label: '📸 Fotografía & Video', value: 'Fotografía & Video' },
    { label: '🌸 Florista & Decoración', value: 'Florista & Decoración' },
    { label: '🏰 Lugar / Venues', value: 'Lugar / Venues' },
    { label: '💄 Maquillaje & Estilo', value: 'Maquillaje & Estilo' },
    { label: '🎻 Música en Vivo', value: 'Música en Vivo' },
    { label: '📋 Coordinación', value: 'Coordinación' },
    { label: '✨ Otro', value: 'Otro' },
  ];

  labelFiltroCategoria = computed(() => {
    const cat = this.categoriaSeleccionada();
    if (cat === 'todas') return 'Todas';
    const found = this.categoriasFiltro.find((c) => c.value === cat);
    return found ? found.label : cat;
  });

  conteoFiltroCategoria = computed(() => {
    const cat = this.categoriaSeleccionada();
    if (cat === 'todas') return this.proveedores().length;
    return this.proveedores().filter((p) => p.categoria === cat).length;
  });

  conteoPorCategoria(categoriaVal: string): number {
    if (categoriaVal === 'todas') return this.proveedores().length;
    return this.proveedores().filter((p) => p.categoria === categoriaVal).length;
  }

  seleccionarCategoria(categoriaVal: string, op: any): void {
    this.categoriaSeleccionada.set(categoriaVal);
    op?.hide();
  }

  hayFiltrosActivos = computed(() => {
    return this.categoriaSeleccionada() !== 'todas' || this.busqueda().trim() !== '';
  });

  limpiarFiltros(): void {
    this.categoriaSeleccionada.set('todas');
    this.busqueda.set('');
  }

  abrirModalProveedor(proveedor?: ProveedorEvento): void {
    const esEdicion = !!proveedor;
    const ref = this.dialogService.open(ProveedorModalComponent, {
      header: esEdicion ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: proveedor ? { proveedor } : undefined,
    });

    ref?.onClose.subscribe((res: any) => {
      if (!res?.proveedor) return;

      const nuevaLista = esEdicion
        ? this.proveedores().map((p) => (p.id === res.proveedor.id ? res.proveedor : p))
        : [...this.proveedores(), res.proveedor];

      const mensaje = esEdicion ? 'Proveedor actualizado.' : 'Proveedor agregado al directorio.';

      this.guardarProveedores(nuevaLista, mensaje);
    });
  }

  eliminarProveedor(proveedor: ProveedorEvento): void {
    this.confirmationService.confirm({
      header: 'Eliminar Proveedor',
      message: `¿Deseas eliminar a "${proveedor.empresa}" del directorio?`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => {
        const nuevaLista = this.proveedores().filter((p) => p.id !== proveedor.id);
        this.guardarProveedores(nuevaLista, 'Proveedor eliminado del directorio.');
      },
    });
  }

  contactarWhatsApp(proveedor: ProveedorEvento): void {
    if (!proveedor.telefono) return;
    const tel = proveedor.telefono.replace(/\D/g, '');
    const ev = this.evento();
    const mensaje = `¡Hola ${proveedor.contactoNombre || proveedor.empresa}! Te contacto sobre los detalles del evento ${ev.titulo}.`;
    const url = `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  private async guardarProveedores(
    nuevaLista: ProveedorEvento[],
    mensajeOk: string,
  ): Promise<void> {
    const evId = this.evento().id;
    if (!evId) return;

    try {
      await this.eventService.actualizarProveedores(evId, nuevaLista);
      const evActualizado: Evento = {
        ...this.evento(),
        proveedores: nuevaLista,
      };
      this.eventoActualizado.emit(evActualizado);

      this.messageService.add({
        severity: 'success',
        summary: 'Directorio Actualizado',
        detail: mensajeOk,
      });
    } catch (err) {
      console.error('Error al guardar proveedores:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el directorio de proveedores.',
      });
    }
  }
}
