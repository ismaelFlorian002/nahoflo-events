import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormaMesa, MesaDiseno } from '../../../../core/models/event.model';

@Component({
  selector: 'app-mesa-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
  ],
  template: `
    <div class="w-full max-w-full overflow-x-hidden p-1">
      <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-5">

        <!-- Nombre de la Mesa -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <i class="pi pi-tag text-amber-500"></i>
            Nombre de la Mesa <span class="text-rose-500">*</span>
          </label>
          <input
            pInputText
            type="text"
            formControlName="nombre"
            placeholder="ej. Mesa 1, Mesa VIP, Mesa Novios"
            class="w-full p-inputtext-sm rounded-xl border-slate-300 focus:border-amber-500 focus:ring-amber-500/20 py-2.5 px-3.5 text-slate-800 font-medium shadow-sm"
          />
          <small
            *ngIf="form.get('nombre')?.invalid && form.get('nombre')?.touched"
            class="text-rose-500 text-xs mt-1 block font-semibold"
          >
            El nombre de la mesa es obligatorio.
          </small>
        </div>

        <!-- Forma de la Mesa & Capacidad -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <i class="pi pi-shapes text-amber-500"></i>
              Forma de la Mesa
            </label>
            <p-dropdown
              [options]="opcionesForma"
              formControlName="forma"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full p-inputtext-sm rounded-xl border-slate-300"
            ></p-dropdown>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <i class="pi pi-users text-amber-500"></i>
              Capacidad (Asientos) <span class="text-rose-500">*</span>
            </label>
            <p-inputNumber
              formControlName="capacidad"
              [min]="1"
              [max]="50"
              [showButtons]="true"
              buttonLayout="horizontal"
              spinnerMode="horizontal"
              decrementButtonClass="p-button-secondary p-button-outlined !rounded-l-xl"
              incrementButtonClass="p-button-secondary p-button-outlined !rounded-r-xl"
              incrementButtonIcon="pi pi-plus"
              decrementButtonIcon="pi pi-minus"
              styleClass="w-full p-inputtext-sm"
            ></p-inputNumber>
          </div>
        </div>

        <!-- Sugerencias rápidas de nombres -->
        <div class="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
          <span class="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-2 flex items-center gap-1">
            <i class="pi pi-bolt text-amber-500"></i> Nombres Sugeridos Rápido:
          </span>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              *ngFor="let sug of sugerencias"
              (click)="usarSugerencia(sug)"
              class="px-3 py-1 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-200 cursor-pointer active:scale-95"
            >
              {{ sug }}
            </button>
          </div>
        </div>

        <!-- Notas / Ubicación -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <i class="pi pi-map-marker text-amber-500"></i>
            Notas / Ubicación (Opcional)
          </label>
          <input
            pInputText
            type="text"
            formControlName="notas"
            placeholder="ej. Junto a la pista de baile, Zona VIP"
            class="w-full p-inputtext-sm rounded-xl border-slate-300 focus:border-amber-500 focus:ring-amber-500/20 py-2.5 px-3.5 text-slate-800 shadow-sm"
          />
        </div>

        <!-- Acciones -->
        <div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
          <button
            pButton
            type="button"
            label="Cancelar"
            icon="pi pi-times"
            class="p-button-text p-button-secondary p-button-sm !rounded-xl"
            (click)="ref.close()"
          ></button>
          <button
            pButton
            type="submit"
            [label]="esEdicion ? 'Guardar Cambios' : 'Crear Mesa'"
            icon="pi pi-check"
            class="p-button-warning p-button-sm !rounded-xl font-bold shadow-md shadow-amber-500/20"
            [disabled]="form.invalid"
          ></button>
        </div>
      </form>
    </div>
  `,
})
export class MesaFormModalComponent implements OnInit {
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private fb = inject(FormBuilder);

  form!: FormGroup;
  esEdicion = false;
  mesaExistente?: MesaDiseno;

  opcionesForma = [
    { label: '🔴 Redonda', value: 'redonda' },
    { label: '🟦 Rectangular', value: 'rectangular' },
    { label: '👑 Imperial (Familia / Novios)', value: 'imperial' },
    { label: '🌙 Cabaret', value: 'cabaret' },
  ];

  sugerencias = [
    'Mesa Novios',
    'Mesa VIP',
    'Familia Novia',
    'Familia Novio',
    'Mesa 1',
    'Mesa 2',
    'Mesa 3',
    'Mesa 4',
    'Mesa 5',
    'Mesa 6',
  ];

  ngOnInit(): void {
    const data = this.config.data || {};
    this.mesaExistente = data.mesa;
    this.esEdicion = !!this.mesaExistente;

    const mesasExistentesCount = data.cantidadMesas || 0;
    const nombreDefecto = this.mesaExistente?.nombre || `Mesa ${mesasExistentesCount + 1}`;

    this.form = this.fb.group({
      nombre: [nombreDefecto, [Validators.required]],
      forma: [this.mesaExistente?.forma || 'redonda', [Validators.required]],
      capacidad: [this.mesaExistente?.capacidad || 10, [Validators.required, Validators.min(1)]],
      notas: [this.mesaExistente?.notas || ''],
    });
  }

  usarSugerencia(sug: string): void {
    this.form.patchValue({ nombre: sug });
  }

  guardar(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const nuevaMesa: MesaDiseno = {
      id: this.mesaExistente?.id || 'mesa_' + Date.now(),
      nombre: val.nombre.trim(),
      forma: val.forma as FormaMesa,
      capacidad: Number(val.capacidad) || 10,
      posX: this.mesaExistente?.posX ?? 50,
      posY: this.mesaExistente?.posY ?? 50,
      notas: val.notas?.trim() || '',
    };

    this.ref.close({ guardado: true, mesa: nuevaMesa });
  }
}
