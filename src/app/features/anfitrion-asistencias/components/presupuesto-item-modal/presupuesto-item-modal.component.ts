import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ItemPresupuesto } from '../../../../core/models/event.model';

@Component({
  selector: 'app-presupuesto-item-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
  ],
  templateUrl: './presupuesto-item-modal.component.html',
  styleUrl: './presupuesto-item-modal.component.scss',
})
export class PresupuestoItemModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  form!: FormGroup;
  item?: ItemPresupuesto;
  esEdicion = false;

  categorias = [
    { label: '🍷 Banquete & Bebidas', value: 'Banquete & Bebidas' },
    { label: '🎧 Música & DJ', value: 'Música & DJ' },
    { label: '🌸 Decoración & Flores', value: 'Decoración & Flores' },
    { label: '📸 Fotografía & Video', value: 'Fotografía & Video' },
    { label: '🏰 Salón / Lugar', value: 'Salón / Lugar' },
    { label: '👗 Vestido & Imagen', value: 'Vestido & Imagen' },
    { label: '🎁 Recuerdos & Papelería', value: 'Recuerdos & Papelería' },
    { label: '📋 Coordinación & Planner', value: 'Coordinación & Planner' },
    { label: '✨ Otros Servicios', value: 'Otros' },
  ];

  estadosPago = [
    { label: '🔴 Pendiente', value: 'pendiente' },
    { label: '🟡 Parcial (Anticipo)', value: 'parcial' },
    { label: '🟢 Pagado Total', value: 'pagado' },
  ];

  ngOnInit(): void {
    this.item = this.config.data?.item;
    this.esEdicion = !!this.item;

    this.form = this.fb.group({
      categoria: [this.item?.categoria || 'Banquete & Bebidas', Validators.required],
      concepto: [this.item?.concepto || '', [Validators.required, Validators.minLength(3)]],
      costoEstimado: [this.item?.costoEstimado ?? 0, [Validators.required, Validators.min(0)]],
      costoReal: [this.item?.costoReal ?? 0, [Validators.required, Validators.min(0)]],
      montoPagado: [this.item?.montoPagado ?? 0, [Validators.required, Validators.min(0)]],
      estadoPago: [this.item?.estadoPago || 'pendiente', Validators.required],
      proveedorNombre: [this.item?.proveedorNombre || ''],
      fechaLimitePago: [this.item?.fechaLimitePago || ''],
      notas: [this.item?.notas || ''],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const resultado: ItemPresupuesto = {
      id: this.item?.id || 'pres_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      categoria: val.categoria,
      concepto: val.concepto.trim(),
      costoEstimado: Number(val.costoEstimado) || 0,
      costoReal: Number(val.costoReal) || 0,
      montoPagado: Number(val.montoPagado) || 0,
      estadoPago: val.estadoPago,
      proveedorNombre: val.proveedorNombre?.trim() || '',
      fechaLimitePago: val.fechaLimitePago || '',
      notas: val.notas?.trim() || '',
    };

    // Auto-ajustar estado si el monto pagado cubre el costo real
    if (resultado.montoPagado >= resultado.costoReal && resultado.costoReal > 0) {
      resultado.estadoPago = 'pagado';
    } else if (resultado.montoPagado > 0) {
      resultado.estadoPago = 'parcial';
    }

    this.ref.close({ item: resultado });
  }

  cancelar(): void {
    this.ref.close();
  }
}
