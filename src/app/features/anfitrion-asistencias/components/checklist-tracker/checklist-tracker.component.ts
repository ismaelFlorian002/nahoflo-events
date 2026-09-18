import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Evento, TareaPlaneacion } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { ChecklistItemModalComponent } from '../checklist-item-modal/checklist-item-modal.component';

@Component({
  selector: 'app-checklist-tracker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ProgressBarModule,
    TagModule,
    CheckboxModule,
    AccordionModule,
  ],
  templateUrl: './checklist-tracker.component.html',
  styleUrl: './checklist-tracker.component.scss',
})
export class ChecklistTrackerComponent {
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  evento = input.required<Evento>();
  eventoActualizado = output<Evento>();

  tareas = computed<TareaPlaneacion[]>(() => this.evento().checklist || []);

  totalTareas = computed(() => this.tareas().length);
  completadasCount = computed(() => this.tareas().filter((t) => t.completada).length);
  porcentajeAvance = computed(() => {
    const tot = this.totalTareas();
    return tot > 0 ? Math.round((this.completadasCount() / tot) * 100) : 0;
  });

  fasesOrdenadas = [
    '12 a 9 Meses Antes',
    '8 a 6 Meses Antes',
    '5 a 3 Meses Antes',
    '2 a 1 Mes Antes',
    'Semana del Evento',
    'Día del Evento',
  ];

  tareasPorFase = computed(() => {
    const lista = this.tareas();
    const mapa = new Map<string, TareaPlaneacion[]>();

    this.fasesOrdenadas.forEach((fase) => mapa.set(fase, []));

    lista.forEach((t) => {
      const faseKey = t.fase || '12 a 9 Meses Antes';
      const arr = mapa.get(faseKey) || [];
      arr.push(t);
      mapa.set(faseKey, arr);
    });

    return this.fasesOrdenadas.map((fase) => ({
      fase,
      items: mapa.get(fase) || [],
      completadas: (mapa.get(fase) || []).filter((i) => i.completada).length,
      total: (mapa.get(fase) || []).length,
    }));
  });

  async toggleTareaCompletada(tarea: TareaPlaneacion): Promise<void> {
    const nuevaLista = this.tareas().map((t) =>
      t.id === tarea.id ? { ...t, completada: !t.completada } : t,
    );
    await this.guardarChecklist(
      nuevaLista,
      tarea.completada ? 'Tarea marcada como pendiente.' : '¡Tarea completada! 🎉',
    );
  }

  abrirModalNuevo(): void {
    const ref = this.dialogService.open(ChecklistItemModalComponent, {
      header: 'Añadir Tarea al Checklist',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.tarea) {
        const nuevaLista = [...this.tareas(), res.tarea];
        this.guardarChecklist(nuevaLista, 'Tarea agregada al checklist.');
      }
    });
  }

  abrirModalEditar(tarea: TareaPlaneacion): void {
    const ref = this.dialogService.open(ChecklistItemModalComponent, {
      header: 'Editar Tarea',
      width: '640px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: { tarea },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.tarea) {
        const nuevaLista = this.tareas().map((t) => (t.id === res.tarea.id ? res.tarea : t));
        this.guardarChecklist(nuevaLista, 'Tarea actualizada.');
      }
    });
  }

  eliminarTarea(tarea: TareaPlaneacion): void {
    this.confirmationService.confirm({
      header: 'Eliminar Tarea',
      message: `¿Deseas eliminar "${tarea.titulo}" del checklist?`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => {
        const nuevaLista = this.tareas().filter((t) => t.id !== tarea.id);
        this.guardarChecklist(nuevaLista, 'Tarea eliminada correctamente.');
      },
    });
  }

  cargarPlantillaBoda(): void {
    this.confirmationService.confirm({
      header: 'Cargar Máster Checklist de Boda / XV Años',
      message: '¿Deseas cargar la lista predefinida de +20 tareas clave distribuidas en todas las etapas del evento?',
      icon: 'pi pi-check-square text-purple-500',
      acceptLabel: 'Sí, cargar plantilla',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary',
      accept: () => {
        const plantilla: TareaPlaneacion[] = [
          // 12 a 9 Meses
          { id: 'c1', fase: '12 a 9 Meses Antes', titulo: 'Definir el presupuesto global y tipo de celebración', responsable: 'Novios', completada: true, prioridad: 'alta' },
          { id: 'c2', fase: '12 a 9 Meses Antes', titulo: 'Elegir y reservar el Salón / Jardín / Hacienda', responsable: 'Novios', completada: true, prioridad: 'alta' },
          { id: 'c3', fase: '12 a 9 Meses Antes', titulo: 'Contratar Wedding Planner / Coordinación General', responsable: 'Novios', completada: false, prioridad: 'alta' },
          { id: 'c4', fase: '12 a 9 Meses Antes', titulo: 'Definir lista preliminar de invitados y número de pases', responsable: 'Novios', completada: false, prioridad: 'media' },

          // 8 a 6 Meses
          { id: 'c5', fase: '8 a 6 Meses Antes', titulo: 'Contratar Banquete, Loza y Cristalería', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c6', fase: '8 a 6 Meses Antes', titulo: 'Contratar DJ, Audio e Iluminación Profesional', responsable: 'Novio', completada: false, prioridad: 'alta' },
          { id: 'c7', fase: '8 a 6 Meses Antes', titulo: 'Contratar Fotografía y Cobertura de Video', responsable: 'Novia', completada: false, prioridad: 'alta' },
          { id: 'c8', fase: '8 a 6 Meses Antes', titulo: 'Elegir el Vestido / Traje Principal', responsable: 'Novia', completada: false, prioridad: 'alta' },

          // 5 a 3 Meses
          { id: 'c9', fase: '5 a 3 Meses Antes', titulo: 'Diseñar la Invitación Digital en NahoFlo Event Studio', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c10', fase: '5 a 3 Meses Antes', titulo: 'Degustación y prueba final de Menú y Postres', responsable: 'Novios', completada: false, prioridad: 'media' },
          { id: 'c11', fase: '5 a 3 Meses Antes', titulo: 'Elegir diseño floral para centros de mesa y altar', responsable: 'Novia', completada: false, prioridad: 'media' },
          { id: 'c12', fase: '5 a 3 Meses Antes', titulo: 'Enviar Save-the-Date o enlaces digitales por WhatsApp', responsable: 'Novios', completada: false, prioridad: 'alta' },

          // 2 a 1 Mes
          { id: 'c13', fase: '2 a 1 Mes Antes', titulo: 'Confirmación de asistencia (RSVP) e invitados finales', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c14', fase: '2 a 1 Mes Antes', titulo: 'Asignación de Mesas y Menús por Invitado', responsable: 'Novios', completada: false, prioridad: 'alta' },
          { id: 'c15', fase: '2 a 1 Mes Antes', titulo: 'Crear el Minutario Técnico / Run-of-Show del Evento', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c16', fase: '2 a 1 Mes Antes', titulo: 'Prueba de Maquillaje y Peinado final', responsable: 'Novia', completada: false, prioridad: 'media' },

          // Semana del Evento
          { id: 'c17', fase: 'Semana del Evento', titulo: 'Liquidación de saldos pendientes a todos los proveedores', responsable: 'Novios', completada: false, prioridad: 'alta' },
          { id: 'c18', fase: 'Semana del Evento', titulo: 'Enviar Minutario Técnico al Staff (DJ, Banquete, Fotógrafo)', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c19', fase: 'Semana del Evento', titulo: 'Imprimir Códigos QR de Mesa para el Álbum Colaborativo', responsable: 'Wedding Planner', completada: false, prioridad: 'media' },

          // Día del Evento
          { id: 'c20', fase: 'Día del Evento', titulo: 'Verificar montaje de salón y pruebas de audio', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c21', fase: 'Día del Evento', titulo: 'Activación del Escáner de Puerta e Ingreso VIP', responsable: 'Wedding Planner', completada: false, prioridad: 'alta' },
          { id: 'c22', fase: 'Día del Evento', titulo: '¡Disfrutar la fiesta al máximo! 🎉', responsable: 'Novios', completada: false, prioridad: 'alta' },
        ];

        this.guardarChecklist(plantilla, 'Máster Checklist de Boda cargado con éxito.');
      },
    });
  }

  private async guardarChecklist(
    nuevaLista: TareaPlaneacion[],
    mensajeOk: string,
  ): Promise<void> {
    const evId = this.evento().id;
    if (!evId) return;

    try {
      await this.eventService.actualizarChecklist(evId, nuevaLista);
      const evActualizado: Evento = {
        ...this.evento(),
        checklist: nuevaLista,
      };
      this.eventoActualizado.emit(evActualizado);

      this.messageService.add({
        severity: 'success',
        summary: 'Checklist Actualizado',
        detail: mensajeOk,
      });
    } catch (err) {
      console.error('Error al guardar checklist:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar la actualización del checklist.',
      });
    }
  }

  obtenerSeverityPrioridad(prioridad?: string): 'danger' | 'warning' | 'info' {
    switch (prioridad) {
      case 'alta':
        return 'danger';
      case 'media':
        return 'warning';
      case 'baja':
        return 'info';
      default:
        return 'info';
    }
  }
}
