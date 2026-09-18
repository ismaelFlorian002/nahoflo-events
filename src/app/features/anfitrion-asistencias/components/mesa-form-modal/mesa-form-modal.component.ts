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
  templateUrl: './mesa-form-modal.component.html',
  styleUrl: './mesa-form-modal.component.scss',
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const nuevaMesa: MesaDiseno = {
      id: this.mesaExistente?.id || 'mesa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
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
