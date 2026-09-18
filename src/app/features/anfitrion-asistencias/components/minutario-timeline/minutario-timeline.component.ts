import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Evento, ItemMinutario } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { copiarAlPortapapeles } from '../../../../core/utils/clipboard.util';
import { MinutarioItemModalComponent } from '../minutario-item-modal/minutario-item-modal.component';

@Component({
  selector: 'app-minutario-timeline',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressBarModule,
    TagModule,
    TooltipModule,
  ],
  providers: [DialogService],
  templateUrl: './minutario-timeline.component.html',
  styleUrl: './minutario-timeline.component.scss',
})
export class MinutarioTimelineComponent {
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  @Input() set eventoInput(val: Evento | null) {
    this.evento.set(val);
  }
  @Output() eventoActualizado = new EventEmitter<Evento>();

  evento = signal<Evento | null>(null);
  guardando = signal<boolean>(false);

  // Lista ordenada por hora
  itemsMinutario = computed(() => {
    const list = this.evento()?.minutario || [];
    return [...list].sort((a, b) => a.hora.localeCompare(b.hora));
  });

  // Métricas de avance
  totalItems = computed(() => this.itemsMinutario().length);
  completadosCount = computed(() => this.itemsMinutario().filter((i) => i.completado).length);
  porcentajeCompletado = computed(() => {
    const tot = this.totalItems();
    if (tot === 0) return 0;
    return Math.round((this.completadosCount() / tot) * 100);
  });

  // Marca / Desmarca un ítem como completado en tiempo real
  async toggleCompletado(item: ItemMinutario): Promise<void> {
    const ev = this.evento();
    if (!ev?.id) return;

    const minutarioActual = ev.minutario || [];
    const nuevoMinutario = minutarioActual.map((i) =>
      i.id === item.id ? { ...i, completado: !i.completado } : i,
    );

    const eventoActualizado: Evento = { ...ev, minutario: nuevoMinutario };
    this.evento.set(eventoActualizado);

    try {
      await this.eventService.actualizarMinutario(ev.id, nuevoMinutario);
      this.eventoActualizado.emit(eventoActualizado);
    } catch (err) {
      console.error('Error al actualizar ítem de minutario:', err);
    }
  }

  // Abre el modal para agregar un nuevo momento
  abrirModalAgregar(): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const ref = this.dialogService.open(MinutarioItemModalComponent, {
      header: 'Agregar Momento al Minutario',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
    });

    ref?.onClose.subscribe(async (res) => {
      if (res?.guardado && res.item) {
        const minutarioActual = ev.minutario || [];
        const nuevoMinutario = [...minutarioActual, res.item];
        await this.guardarListaMinutario(ev.id!, nuevoMinutario, 'Momento agregado al minutario.');
      }
    });
  }

  // Abre el modal para editar un momento
  abrirModalEditar(item: ItemMinutario): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const ref = this.dialogService.open(MinutarioItemModalComponent, {
      header: 'Editar Momento',
      width: '540px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
      data: { item },
    });

    ref?.onClose.subscribe(async (res) => {
      if (res?.guardado && res.item) {
        const minutarioActual = ev.minutario || [];
        const nuevoMinutario = minutarioActual.map((i) => (i.id === item.id ? res.item : i));
        await this.guardarListaMinutario(ev.id!, nuevoMinutario, 'Momento actualizado.');
      }
    });
  }

  // Elimina un momento del minutario
  eliminarItem(item: ItemMinutario): void {
    const ev = this.evento();
    if (!ev?.id) return;

    this.confirmationService.confirm({
      header: 'Eliminar Momento',
      message: `¿Deseas eliminar "${item.actividad}" (${item.hora}) del cronograma?`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'bg-red-600 hover:bg-red-700 text-white border-0',
      accept: async () => {
        const minutarioActual = ev.minutario || [];
        const nuevoMinutario = minutarioActual.filter((i) => i.id !== item.id);
        await this.guardarListaMinutario(ev.id!, nuevoMinutario, 'Momento eliminado.');
      },
    });
  }

  // Carga una plantilla predefinida de Boda / Evento
  cargarPlantillaEstandar(): void {
    const ev = this.evento();
    if (!ev?.id) return;

    this.confirmationService.confirm({
      header: 'Cargar Plantilla Estándar',
      message: '¿Deseas cargar el cronograma sugerido para Bodas / Eventos? Esto añadirá los momentos clave principales.',
      icon: 'pi pi-sparkles text-gold-500',
      acceptLabel: 'Sí, cargar plantilla',
      rejectLabel: 'Cancelar',
      accept: async () => {
        const plantilla: ItemMinutario[] = [
          { id: 'p1', hora: '16:00', actividad: 'Ceremonia Religiosa / Civil', responsable: 'Oficiante', detalles: 'Llegada de invitados y encuadre fotográfico.', completado: false },
          { id: 'p2', hora: '17:30', actividad: 'Recepción y Cóctel de Bienvenida', responsable: 'Banquetero', detalles: 'Bebidas de bienvenida y música ambiental.', completado: false },
          { id: 'p3', hora: '18:30', actividad: 'Entrada Triunfal de los Novios', responsable: 'DJ / Música', detalles: 'Chisperos fríos y ovación de invitados.', completado: false },
          { id: 'p4', hora: '19:00', actividad: 'Servicio de Banquete', responsable: 'Banquetero', detalles: 'Cena principal de 3 tiempos.', completado: false },
          { id: 'p5', hora: '20:30', actividad: 'Vals de los Novios y Padres', responsable: 'DJ / Música', detalles: 'Pista iluminada y vals con papás.', completado: false },
          { id: 'p6', hora: '21:00', actividad: 'Apertura de Pista y Baile', responsable: 'DJ / Música', detalles: 'Inicio del show de luces y fiesta general.', completado: false },
          { id: 'p7', hora: '23:30', actividad: 'Brindis y Pastel', responsable: 'Coordinador', detalles: 'Corte de pastel y palabras de agradecimiento.', completado: false },
          { id: 'p8', hora: '01:00', actividad: 'Cierre de Evento', responsable: 'Staff', detalles: 'Salida gradual de invitados.', completado: false },
        ];

        await this.guardarListaMinutario(ev.id!, plantilla, 'Plantilla de cronograma cargada con éxito.');
      },
    });
  }

  // Copia el minutario formateado para WhatsApp
  copiarMinutarioWhatsApp(): void {
    const items = this.itemsMinutario();
    if (items.length === 0) return;

    const titulo = this.evento()?.titulo || 'Evento';
    let texto = `📋 *MINUTARIO Y CRONOGRAMA TÉCNICO*\n🎉 *${titulo.toUpperCase()}*\n\n`;

    items.forEach((item) => {
      const check = item.completado ? '✅' : '⏳';
      texto += `${check} *${item.hora}* - ${item.actividad}\n`;
      if (item.responsable) texto += `   👤 *Responsable:* ${item.responsable}\n`;
      if (item.detalles) texto += `   📝 *Notas:* ${item.detalles}\n`;
      texto += `\n`;
    });

    texto += `\n_Generado por NahoFlo Event Studio · nahoflo.com_`;

    copiarAlPortapapeles(texto);
    this.messageService.add({
      severity: 'success',
      summary: 'Minutario Copiado',
      detail: 'El cronograma fue copiado al portapapeles listo para enviar por WhatsApp.',
    });
  }

  private async guardarListaMinutario(eventoId: string, lista: ItemMinutario[], mensajeExito: string): Promise<void> {
    this.guardando.set(true);
    try {
      await this.eventService.actualizarMinutario(eventoId, lista);
      const eventoActualizado: Evento = { ...this.evento()!, minutario: lista };
      this.evento.set(eventoActualizado);
      this.eventoActualizado.emit(eventoActualizado);
      this.messageService.add({
        severity: 'success',
        summary: 'Minutario Actualizado',
        detail: mensajeExito,
      });
    } catch (err) {
      console.error('Error al guardar minutario:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo actualizar el minutario.',
      });
    } finally {
      this.guardando.set(false);
    }
  }

  getBadgeResponsableClass(responsable?: string): string {
    const r = (responsable || '').toLowerCase();
    if (r.includes('dj') || r.includes('música')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (r.includes('banquete') || r.includes('mesero')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (r.includes('fotó') || r.includes('video')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (r.includes('novio') || r.includes('anfitr')) return 'bg-pink-100 text-pink-800 border-pink-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
