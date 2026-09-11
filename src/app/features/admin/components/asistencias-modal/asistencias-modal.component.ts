import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EventService } from '../../../../core/services/event.service';
import { InvitadoModel } from '../../../../core/models/invitado.model';

@Component({
  selector: 'app-asistencias-modal',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule, ButtonModule, ProgressSpinnerModule],
  templateUrl: './asistencias-modal.component.html',
  styleUrl: './asistencias-modal.component.scss',
})
export class AsistenciasModalComponent implements OnInit {
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  evento: any;
  invitados: InvitadoModel[] = [];
  cargando = true;

  // Métricas
  totalPasesConfirmados = 0;
  totalAsistentes = 0;
  totalCancelados = 0;

  async ngOnInit() {
    this.evento = this.config.data;

    if (this.evento?.id) {
      try {
        this.invitados = await this.eventService.getInvitados(this.evento.id);
        this.calcularMetricas();
      } catch (error) {
        console.error('Error al cargar la lista de invitados:', error);
      } finally {
        this.cargando = false;
      }
    } else {
      this.cargando = false;
    }
  }

  calcularMetricas() {
    this.totalPasesConfirmados = this.invitados
      .filter((i) => i.asistira)
      .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);

    this.totalAsistentes = this.invitados.filter((i) => i.asistira).length;
    this.totalCancelados = this.invitados.filter((i) => !i.asistira).length;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '-';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
