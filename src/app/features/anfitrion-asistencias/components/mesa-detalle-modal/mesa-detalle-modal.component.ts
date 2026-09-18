import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MesaDiseno } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';

@Component({
  selector: 'app-mesa-detalle-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, DropdownModule, FormsModule],
  template: `
    <div class="w-full max-w-full overflow-x-hidden p-1 flex flex-col gap-5">
      <!-- Encabezado de la Mesa -->
      <div class="flex items-center justify-between bg-gradient-to-r from-amber-50 via-white to-amber-50/50 p-4 rounded-2xl border border-amber-200/80 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-black text-slate-900">{{ mesa.nombre }}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
              {{ mesa.forma }}
            </span>
          </div>
          <p *ngIf="mesa.notas" class="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <i class="pi pi-map-marker text-amber-500"></i> {{ mesa.notas }}
          </p>
        </div>

        <!-- Indicador de Capacidad -->
        <div class="text-right">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ocupación</div>
          <div
            class="text-base font-extrabold px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm"
            [ngClass]="{
              'bg-emerald-100 text-emerald-800 border border-emerald-300': totalAsientosOcupados() <= mesa.capacidad,
              'bg-rose-100 text-rose-800 border border-rose-300': totalAsientosOcupados() > mesa.capacidad
            }"
          >
            <span>{{ totalAsientosOcupados() }} / {{ mesa.capacidad }}</span>
            <i *ngIf="totalAsientosOcupados() > mesa.capacidad" class="pi pi-exclamation-triangle text-rose-600"></i>
          </div>
        </div>
      </div>

      <!-- Agregar Invitado a la Mesa -->
      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-inner">
        <div class="flex-1">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <i class="pi pi-user-plus text-amber-500"></i> Asignar Invitado a esta Mesa:
          </label>
          <p-dropdown
            [options]="opcionesInvitadosSinMesa()"
            [(ngModel)]="invitadoSeleccionadoId"
            optionLabel="label"
            optionValue="value"
            placeholder="Selecciona un invitado sin mesa..."
            styleClass="w-full p-inputtext-sm rounded-xl border-slate-300"
            [filter]="true"
            filterBy="label"
          ></p-dropdown>
        </div>
        <button
          pButton
          type="button"
          label="Asignar"
          icon="pi pi-plus"
          class="p-button-warning p-button-sm !rounded-xl font-bold self-end sm:self-auto shadow-sm"
          [disabled]="!invitadoSeleccionadoId"
          (click)="agregarInvitadoAMesa()"
        ></button>
      </div>

      <!-- Lista de Comensales Sentados -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-2">
            <i class="pi pi-users text-amber-500"></i>
            Invitados Asignados ({{ invitadosSentados().length }})
          </h4>
        </div>

        <div *ngIf="invitadosSentados().length === 0" class="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 bg-slate-50/50">
          <i class="pi pi-inbox text-3xl mb-1 text-slate-300 block"></i>
          <p class="text-xs font-medium m-0">No hay invitados asignados a esta mesa todavía.</p>
        </div>

        <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
          <div
            *ngFor="let inv of invitadosSentados()"
            class="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-amber-400 transition-all shadow-sm"
          >
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-sm text-slate-900">{{ inv.nombre }}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  🎟️ {{ inv.pasesConfirmados || 1 }} {{ (inv.pasesConfirmados || 1) === 1 ? 'pase' : 'pases' }}
                </span>
                <span *ngIf="inv.tipoMenu" class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  🍽️ {{ inv.tipoMenu }}
                </span>
              </div>

              <!-- Alertas Médicas o de Alergias -->
              <div *ngIf="inv.restriccionesAlimentarias" class="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 w-fit">
                <i class="pi pi-exclamation-circle text-rose-500"></i>
                <span>Alergia/Dieta: {{ inv.restriccionesAlimentarias }}</span>
              </div>
            </div>

            <!-- Botón desasignar -->
            <button
              pButton
              type="button"
              icon="pi pi-times"
              class="p-button-rounded p-button-text p-button-danger p-button-sm"
              pTooltip="Quitar de esta mesa"
              (click)="removerInvitado(inv)"
            ></button>
          </div>
        </div>
      </div>

      <!-- Acciones de Administración de Mesa -->
      <div class="flex justify-between items-center pt-4 border-t border-slate-100 mt-1">
        <button
          pButton
          type="button"
          label="Eliminar Mesa"
          icon="pi pi-trash"
          class="p-button-text p-button-danger p-button-sm !rounded-xl"
          (click)="eliminarMesa()"
        ></button>

        <div class="flex gap-2">
          <button
            pButton
            type="button"
            label="Editar Mesa"
            icon="pi pi-pencil"
            class="p-button-outlined p-button-secondary p-button-sm !rounded-xl"
            (click)="editarMesa()"
          ></button>
          <button
            pButton
            type="button"
            label="Listo"
            icon="pi pi-check"
            class="p-button-warning p-button-sm !rounded-xl font-bold shadow-md shadow-amber-500/20"
            (click)="ref.close({ cambio: true })"
          ></button>
        </div>
      </div>
    </div>
  `,
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
