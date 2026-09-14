import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ClienteService } from '../../../../core/services/cliente.service';
import { ClienteModel } from '../../../../core/models/cliente.model';

@Component({
  selector: 'app-cliente-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
  ],
  templateUrl: './cliente-modal.component.html',
  styleUrl: './cliente-modal.component.scss',
})
export class ClienteModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clienteService = inject(ClienteService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  guardando = false;
  clienteEnEdicion: ClienteModel | null = null;

  clienteForm = this.fb.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
    telefono: ['', [Validators.required, Validators.minLength(7)]],
    email: [''],
    notas: [''],
  });

  ngOnInit() {
    if (this.config.data) {
      this.clienteEnEdicion = this.config.data;
      this.clienteForm.patchValue({
        nombreCompleto: this.clienteEnEdicion?.nombreCompleto || '',
        telefono: this.clienteEnEdicion?.telefono || '',
        email: this.clienteEnEdicion?.email || '',
        notas: this.clienteEnEdicion?.notas || '',
      });
    }
  }

  async guardarCliente() {
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const formVal = this.clienteForm.value;

    try {
      if (this.clienteEnEdicion?.id) {
        // Modo Edición
        await this.clienteService.updateCliente(this.clienteEnEdicion.id, {
          nombreCompleto: formVal.nombreCompleto?.trim() || '',
          telefono: formVal.telefono?.trim() || '',
          email: formVal.email?.trim() || '',
          notas: formVal.notas?.trim() || '',
        });
      } else {
        // Modo Creación
        await this.clienteService.createCliente({
          nombreCompleto: formVal.nombreCompleto?.trim() || '',
          telefono: formVal.telefono?.trim() || '',
          email: formVal.email?.trim() || '',
          notas: formVal.notas?.trim() || '',
          totalEventos: 0,
          creadoEn: new Date(),
        });
      }

      this.ref.close(true);
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
    } finally {
      this.guardando = false;
    }
  }

  cancelar() {
    this.ref.close(false);
  }
}
