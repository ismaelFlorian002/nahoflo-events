import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ProveedorEvento } from '../../../../core/models/event.model';

@Component({
  selector: 'app-proveedor-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    FloatLabelModule,
  ],
  templateUrl: './proveedor-modal.component.html',
  styleUrl: './proveedor-modal.component.scss',
})
export class ProveedorModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  form!: FormGroup;
  proveedor?: ProveedorEvento;
  esEdicion = false;

  categorias = [
    { label: '🎧 DJ & Audio / Iluminación', value: 'DJ & Audio' },
    { label: '🍷 Banquete & Banquetero', value: 'Banquete' },
    { label: '📸 Fotógrafo / Videoasta', value: 'Fotografía & Video' },
    { label: '🌸 Florista & Diseñador', value: 'Florista & Decoración' },
    { label: '🏰 Salón / Jardín / Hacienda', value: 'Lugar / Venues' },
    { label: '💄 Maquillista & Peinado', value: 'Maquillaje & Estilo' },
    { label: '🎻 Música En Vivo / Mariachi', value: 'Música en Vivo' },
    { label: '📋 Wedding Planner / Coordinador', value: 'Coordinación' },
    { label: '✨ Otro Proveedor', value: 'Otro' },
  ];

  ngOnInit(): void {
    this.proveedor = this.config.data?.proveedor;
    this.esEdicion = !!this.proveedor;

    this.form = this.fb.group({
      empresa: [this.proveedor?.empresa || '', [Validators.required, Validators.minLength(2)]],
      categoria: [this.proveedor?.categoria || 'DJ & Audio', Validators.required],
      contactoNombre: [this.proveedor?.contactoNombre || ''],
      telefono: [this.proveedor?.telefono || ''],
      email: [this.proveedor?.email || '', [Validators.email]],
      montoContrato: [this.proveedor?.montoContrato ?? 0, [Validators.min(0)]],
      notas: [this.proveedor?.notas || ''],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const resultado: ProveedorEvento = {
      id: this.proveedor?.id || 'prov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      empresa: val.empresa.trim(),
      categoria: val.categoria,
      contactoNombre: val.contactoNombre?.trim() || '',
      telefono: val.telefono?.trim() || '',
      email: val.email?.trim() || '',
      montoContrato: Number(val.montoContrato) || 0,
      notas: val.notas?.trim() || '',
    };

    this.ref.close({ proveedor: resultado });
  }

  cancelar(): void {
    this.ref.close();
  }
}
