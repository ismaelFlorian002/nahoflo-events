import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ItemMinutario } from '../../../../core/models/event.model';

@Component({
  selector: 'app-minutario-item-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    FloatLabelModule,
  ],
  templateUrl: './minutario-item-modal.component.html',
  styleUrl: './minutario-item-modal.component.scss',
})
export class MinutarioItemModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  item?: ItemMinutario;
  esEdicion = false;
  form!: FormGroup;

  opcionesResponsables = [
    { label: '🎧 DJ / Orquesta / Música', value: 'DJ / Música' },
    { label: '📋 Coordinador / Wedding Planner', value: 'Coordinador' },
    { label: '🍽️ Banquetero / Meseros', value: 'Banquetero' },
    { label: '📸 Fotógrafo / Videógrafo', value: 'Fotógrafo' },
    { label: '👑 Novios / Anfitriones', value: 'Novios / Anfitriones' },
    { label: '⛪ Sacerdote / Juez', value: 'Oficiante' },
    { label: '✨ Staff General', value: 'Staff' },
  ];

  ngOnInit(): void {
    this.item = this.config.data?.item;
    this.esEdicion = !!this.item;

    this.form = this.fb.group({
      hora: [this.item?.hora || '16:00', [Validators.required]],
      actividad: [this.item?.actividad || '', [Validators.required, Validators.minLength(2)]],
      responsable: [this.item?.responsable || 'Coordinador', [Validators.required]],
      detalles: [this.item?.detalles || ''],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const itemResultado: ItemMinutario = {
      id: this.item?.id || 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      hora: val.hora.trim(),
      actividad: val.actividad.trim(),
      responsable: val.responsable.trim(),
      detalles: val.detalles?.trim() || '',
      completado: this.item?.completado ?? false,
    };

    this.ref.close({ guardado: true, item: itemResultado });
  }

  cancelar(): void {
    this.ref.close(false);
  }
}
