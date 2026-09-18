import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Evento, ItemPresupuesto } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { PresupuestoItemModalComponent } from '../presupuesto-item-modal/presupuesto-item-modal.component';
import { BadgeModule } from 'primeng/badge';

@Component({
  selector: 'app-presupuesto-tracker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    ProgressBarModule,
    InputTextModule,
    DropdownModule,
    BadgeModule,
  ],
  templateUrl: './presupuesto-tracker.component.html',
  styleUrl: './presupuesto-tracker.component.scss',
})
export class PresupuestoTrackerComponent {
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  evento = input.required<Evento>();
  eventoActualizado = output<Evento>();

  // Filtros
  categoriaSeleccionada = signal<string>('todas');
  busqueda = signal<string>('');

  items = computed<ItemPresupuesto[]>(() => this.evento().presupuesto || []);

  itemsFiltrados = computed(() => {
    let lista = this.items();
    const cat = this.categoriaSeleccionada();
    const q = this.busqueda().trim().toLowerCase();

    if (cat !== 'todas') {
      lista = lista.filter((i) => i.categoria === cat);
    }

    if (q) {
      lista = lista.filter(
        (i) =>
          i.concepto.toLowerCase().includes(q) ||
          (i.proveedorNombre && i.proveedorNombre.toLowerCase().includes(q)) ||
          (i.notas && i.notas.toLowerCase().includes(q)),
      );
    }

    return lista;
  });

  // Cálculos Financieros Reactivos
  totalEstimado = computed(() =>
    this.items().reduce((acc, i) => acc + (Number(i.costoEstimado) || 0), 0),
  );

  totalReal = computed(() => this.items().reduce((acc, i) => acc + (Number(i.costoReal) || 0), 0));

  totalPagado = computed(() =>
    this.items().reduce((acc, i) => acc + (Number(i.montoPagado) || 0), 0),
  );

  saldoPendiente = computed(() => Math.max(0, this.totalReal() - this.totalPagado()));

  porcentajePagado = computed(() => {
    const tot = this.totalReal();
    return tot > 0 ? Math.min(100, Math.round((this.totalPagado() / tot) * 100)) : 0;
  });

  variacionPresupuesto = computed(() => this.totalReal() - this.totalEstimado());

  variacionAbsoluta = computed(() => Math.abs(this.variacionPresupuesto()));

  categoriasFiltro = [
    { label: 'Todas las Categorías', value: 'todas' },
    { label: '🍷 Banquete & Bebidas', value: 'Banquete & Bebidas' },
    { label: '🎧 Música & DJ', value: 'Música & DJ' },
    { label: '🌸 Decoración & Flores', value: 'Decoración & Flores' },
    { label: '📸 Fotografía & Video', value: 'Fotografía & Video' },
    { label: '🏰 Salón / Lugar', value: 'Salón / Lugar' },
    { label: '👗 Vestido & Imagen', value: 'Vestido & Imagen' },
    { label: '🎁 Recuerdos & Papelería', value: 'Recuerdos & Papelería' },
    { label: '📋 Coordinación & Planner', value: 'Coordinación & Planner' },
    { label: '✨ Otros', value: 'Otros' },
  ];

  abrirModalNuevo(): void {
    const ref = this.dialogService.open(PresupuestoItemModalComponent, {
      header: 'Registrar Nueva Partida Presupuestaria',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.item) {
        const nuevaLista = [...this.items(), res.item];
        this.guardarPresupuesto(nuevaLista, 'Partida agregada al presupuesto.');
      }
    });
  }

  abrirModalEditar(item: ItemPresupuesto): void {
    const ref = this.dialogService.open(PresupuestoItemModalComponent, {
      header: 'Editar Partida Presupuestaria',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: { item },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.item) {
        const nuevaLista = this.items().map((i) => (i.id === res.item.id ? res.item : i));
        this.guardarPresupuesto(nuevaLista, 'Partida actualizada.');
      }
    });
  }

  eliminarItem(item: ItemPresupuesto): void {
    this.confirmationService.confirm({
      header: 'Eliminar Partida Presupuestaria',
      message: `¿Deseas eliminar "${item.concepto}" del presupuesto?`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-text',
      accept: () => {
        const nuevaLista = this.items().filter((i) => i.id !== item.id);
        this.guardarPresupuesto(nuevaLista, 'Partida eliminada correctamente.');
      },
    });
  }

  cargarPlantillaBoda(): void {
    this.confirmationService.confirm({
      header: 'Cargar Presupuesto Base de Bodas',
      message:
        '¿Deseas cargar una estructura predefinida de rubros presupuestarios (Banquete, DJ, Flores, Fotografía, Vestido, etc.)?',
      icon: 'pi pi-wallet text-amber-500',
      acceptLabel: 'Sí, cargar plantilla',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary',
      accept: () => {
        const plantilla: ItemPresupuesto[] = [
          {
            id: 'p_1',
            categoria: 'Salón / Lugar',
            concepto: 'Renta de Salón / Jardín Principal',
            costoEstimado: 35000,
            costoReal: 35000,
            montoPagado: 10000,
            estadoPago: 'parcial',
            notas: 'Incluye 8 horas de evento y planta de luz',
          },
          {
            id: 'p_2',
            categoria: 'Banquete & Bebidas',
            concepto: 'Banquete 3 Tiempos & Mezcladores (150 personas)',
            costoEstimado: 60000,
            costoReal: 62000,
            montoPagado: 20000,
            estadoPago: 'parcial',
            notas: 'Incluye loza, cristalería y servicio de meseros',
          },
          {
            id: 'p_3',
            categoria: 'Música & DJ',
            concepto: 'DJ, Audio Profesional & Iluminación Robótica',
            costoEstimado: 18000,
            costoReal: 18000,
            montoPagado: 18000,
            estadoPago: 'pagado',
            notas: 'Incluye chisperos fríos para el vals',
          },
          {
            id: 'p_4',
            categoria: 'Decoración & Flores',
            concepto: 'Diseño Floral Centros de Mesa & Arreglo Principal',
            costoEstimado: 22000,
            costoReal: 20000,
            montoPagado: 5000,
            estadoPago: 'parcial',
          },
          {
            id: 'p_5',
            categoria: 'Fotografía & Video',
            concepto: 'Cobertura Completa + Video Drone & Álbum',
            costoEstimado: 25000,
            costoReal: 25000,
            montoPagado: 10000,
            estadoPago: 'parcial',
          },
          {
            id: 'p_6',
            categoria: 'Coordinación & Planner',
            concepto: 'Coordinación Día del Evento & Minutario',
            costoEstimado: 12000,
            costoReal: 12000,
            montoPagado: 12000,
            estadoPago: 'pagado',
          },
        ];

        this.guardarPresupuesto(plantilla, 'Plantilla de presupuesto cargada con éxito.');
      },
    });
  }

  private async guardarPresupuesto(
    nuevaLista: ItemPresupuesto[],
    mensajeOk: string,
  ): Promise<void> {
    const evId = this.evento().id;
    if (!evId) return;

    try {
      await this.eventService.actualizarPresupuesto(evId, nuevaLista);
      const evActualizado: Evento = {
        ...this.evento(),
        presupuesto: nuevaLista,
      };
      this.eventoActualizado.emit(evActualizado);

      this.messageService.add({
        severity: 'success',
        summary: 'Presupuesto Actualizado',
        detail: mensajeOk,
      });
    } catch (err) {
      console.error('Error al guardar presupuesto:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la actualización en el presupuesto.',
      });
    }
  }

  obtenerSeverityEstado(estado: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (estado) {
      case 'pagado':
        return 'success';
      case 'parcial':
        return 'warning';
      case 'pendiente':
        return 'danger';
      default:
        return 'info';
    }
  }
}
