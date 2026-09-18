import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { Evento } from '../../../../core/models/event.model';
import { BadgeModule } from 'primeng/badge';

@Component({
  selector: 'app-invitado-detalle-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, BadgeModule],
  templateUrl: './invitado-detalle-modal.component.html',
  styleUrl: './invitado-detalle-modal.component.scss',
})
export class InvitadoDetalleModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  invitado!: InvitadoModel;
  evento!: Evento;

  ngOnInit(): void {
    this.invitado = this.config.data?.invitado;
    this.evento = this.config.data?.evento;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'No registrada';
    try {
      const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
      if (isNaN(f.getTime())) return 'No registrada';
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(f);
    } catch {
      return 'No registrada';
    }
  }

  cerrar(): void {
    this.ref.close();
  }

  editar(): void {
    this.ref.close({ accion: 'editar', invitado: this.invitado });
  }
}
