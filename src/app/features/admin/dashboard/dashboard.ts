import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { EventService } from '../../../core/services/eventService';
import { EventFormComponent } from '../components/event-form/event-form';
import { AsistenciasModalComponent } from '../components/asistencias-modal/asistencias-modal.component';
import { DockModule } from 'primeng/dock';

// CORRECCIÓN 1: La ruta del servicio (3 niveles arriba)

// CORRECCIÓN 2: La ruta del formulario (Solo 1 nivel arriba, teníamos un ../ de sobra)

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    TagModule,
    DynamicDialogModule,
    DockModule,
  ],
  providers: [DialogService],

  // CORRECCIÓN 3: Angular dice que no encuentra el archivo HTML.
  // Fíjate en el panel de la izquierda de tu WebStorm cómo se llama tu archivo HTML realmente.
  // Si se llama solo "dashboard.html", quítale el ".component" a esta línea:
  templateUrl: './dashboard.html',

  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  private eventService = inject(EventService);
  private cdr = inject(ChangeDetectorRef);
  private dialogService = inject(DialogService); // Inyectamos el servicio

  eventos: any[] = [];

  async ngOnInit() {
    this.eventos = await this.eventService.getEvents();
    this.cdr.detectChanges();
  }

  // MAGIA: Abrimos el formulario de forma dinámica
  openDialog(eventoAEditar?: any) {
    const ref = this.dialogService.open(EventFormComponent, {
      // 1. Título dinámico: Si hay datos, dice "Editar", si no, dice "Crear"
      header: eventoAEditar ? 'Editar Evento' : 'Crear Nuevo Evento',
      width: '1200px',
      breakpoints: { '960px': '75vw', '640px': '90vw' },
      closable: true,
      focusOnShow: false,

      // 2. EL ESLABÓN PERDIDO: Inyectamos los datos para que el modal los lea
      data: eventoAEditar,
    });

    // Escuchamos cuando el modal se cierra
    ref?.onClose.subscribe(async (exito: boolean) => {
      // Si recibimos "true", significa que se guardó. Recargamos la tabla.
      if (exito) {
        this.eventos = await this.eventService.getEvents();
        this.cdr.detectChanges();
      }
    });
  }
  async toggleEstado(evento: any) {
    // Solo para que el mensaje de alerta tenga sentido
    const accion = evento.estaActivo ? 'desactivar (pasar a borrador)' : 'activar';

    if (confirm(`¿Estás seguro de ${accion} este evento?`)) {
      // Magia: !evento.estaActivo invierte el valor (si es true lo hace false, y viceversa)
      await this.eventService.updateEvent(evento.id, { estaActivo: !evento.estaActivo });

      // Recargamos la tabla
      this.eventos = await this.eventService.getEvents();
      this.cdr.detectChanges();
    }
  }

  // Abre el modal desacoplado de asistencias
  verAsistencias(evento: any) {
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
}
