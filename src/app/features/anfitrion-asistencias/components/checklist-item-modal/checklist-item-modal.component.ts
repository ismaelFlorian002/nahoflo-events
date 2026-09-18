import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TareaPlaneacion } from '../../../../core/models/event.model';

@Component({
  selector: 'app-checklist-item-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
  ],
  templateUrl: './checklist-item-modal.component.html',
  styleUrl: './checklist-item-modal.component.scss',
})
export class ChecklistItemModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  form!: FormGroup;
  tarea?: TareaPlaneacion;
  esEdicion = false;

  fases = [
    { label: '🗓️ 12 a 9 Meses Antes', value: '12 a 9 Meses Antes' },
    { label: '📅 8 a 6 Meses Antes', value: '8 a 6 Meses Antes' },
    { label: '⏰ 5 a 3 Meses Antes', value: '5 a 3 Meses Antes' },
    { label: '✉️ 2 a 1 Mes Antes', value: '2 a 1 Mes Antes' },
    { label: '🔥 Semana del Evento', value: 'Semana del Evento' },
    { label: '🎉 Día del Evento', value: 'Día del Evento' },
  ];

  responsables = [
    { label: '👑 Novios / Anfitriones', value: 'Novios' },
    { label: '📋 Wedding Planner', value: 'Wedding Planner' },
    { label: '👰 Novia', value: 'Novia' },
    { label: '🤵 Novio', value: 'Novio' },
    { label: '🤝 Proveedor / Coordinación', value: 'Proveedor' },
  ];

  prioridades = [
    { label: '🔴 Alta', value: 'alta' },
    { label: '🟡 Media', value: 'media' },
    { label: '🟢 Baja', value: 'baja' },
  ];

  ngOnInit(): void {
    this.tarea = this.config.data?.tarea;
    this.esEdicion = !!this.tarea;

    this.form = this.fb.group({
      fase: [this.tarea?.fase || '12 a 9 Meses Antes', Validators.required],
      titulo: [this.tarea?.titulo || '', [Validators.required, Validators.minLength(3)]],
      responsable: [this.tarea?.responsable || 'Novios'],
      prioridad: [this.tarea?.prioridad || 'media'],
      fechaLimite: [this.tarea?.fechaLimite || ''],
      notas: [this.tarea?.notas || ''],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const resultado: TareaPlaneacion = {
      id: this.tarea?.id || 'chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      fase: val.fase,
      titulo: val.titulo.trim(),
      responsable: val.responsable,
      prioridad: val.prioridad,
      fechaLimite: val.fechaLimite || '',
      completada: this.tarea?.completada ?? false,
      notas: val.notas?.trim() || '',
    };

    this.ref.close({ tarea: resultado });
  }

  cancelar(): void {
    this.ref.close();
  }
}
