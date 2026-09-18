import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MesaDiseno } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';

@Component({
  selector: 'app-mesa-detalle-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, DropdownModule, TooltipModule, FormsModule],
  templateUrl: './mesa-detalle-modal.component.html',
  styleUrl: './mesa-detalle-modal.component.scss',
})
export class MesaDetalleModalComponent implements OnInit {
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

  mesa!: MesaDiseno;
  todosInvitados: InvitadoModel[] = [];

  invitadosSentados = signal<InvitadoModel[]>([]);
  invitadoSeleccionadoId: string | null = null;

  ngOnInit(): void {
    const data = this.config.data || {};
    this.mesa = data.mesa;
    this.todosInvitados = data.invitados || [];
    this.actualizarSentados();
  }

  actualizarSentados(): void {
    const sentados = this.todosInvitados.filter(
      (i) => i.mesa && i.mesa.trim().toLowerCase() === this.mesa.nombre.trim().toLowerCase(),
    );
    this.invitadosSentados.set(sentados);
  }

  totalAsientosOcupados(): number {
    return this.invitadosSentados().reduce(
      (acc, i) => acc + (Number(i.pasesConfirmados) || 1),
      0,
    );
  }

  opcionesInvitadosSinMesa(): { label: string; value: string }[] {
    return this.todosInvitados
      .filter((i) => !i.mesa || i.mesa.trim() === '')
      .map((i) => ({
        label: `${i.nombre} (${i.pasesConfirmados || 1} pases)`,
        value: i.id!,
      }));
  }

  agregarInvitadoAMesa(): void {
    if (!this.invitadoSeleccionadoId) return;
    const inv = this.todosInvitados.find((i) => i.id === this.invitadoSeleccionadoId);
    if (inv) {
      inv.mesa = this.mesa.nombre;
      this.actualizarSentados();
      this.invitadoSeleccionadoId = null;
    }
  }

  removerInvitado(invitado: InvitadoModel): void {
    invitado.mesa = '';
    this.actualizarSentados();
  }

  editarMesa(): void {
    this.ref.close({ accion: 'editar', mesa: this.mesa });
  }

  eliminarMesa(): void {
    // Desasignar mesa a todos los invitados que estaban sentados
    this.invitadosSentados().forEach((i) => (i.mesa = ''));
    this.ref.close({ accion: 'eliminar', mesaId: this.mesa.id });
  }
}
