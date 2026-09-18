import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ClienteService } from '../../../../core/services/cliente.service';
import { ClienteModel } from '../../../../core/models/cliente.model';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-cliente-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    FloatLabelModule,
  ],
  templateUrl: './cliente-modal.component.html',
  styleUrl: './cliente-modal.component.scss',
})
export class ClienteModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clienteService = inject(ClienteService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

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

  guardarCliente() {
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Ingresa un nombre y teléfono válidos para el cliente.',
      });
      return;
    }

    const formVal = this.clienteForm.value;
    const esEdicion = !!this.clienteEnEdicion?.id;
    const nombre = formVal.nombreCompleto?.trim() || '';

    this.confirmationService.confirm({
      header: esEdicion ? 'Confirmar Edición' : 'Confirmar Nuevo Cliente',
      message: esEdicion
        ? `¿Deseas guardar los cambios del cliente "${nombre}"?`
        : `¿Deseas agregar a "${nombre}" al catálogo de clientes?`,
      icon: 'pi pi-user-plus text-gold-500',
      acceptLabel: esEdicion ? 'Guardar Cambios' : 'Registrar Cliente',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'bg-gold-500 hover:bg-gold-600 text-white border-0',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        await this.ejecutarGuardado(formVal, esEdicion, nombre);
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se guardó la información del cliente.',
        });
      },
    });
  }

  private async ejecutarGuardado(formVal: any, esEdicion: boolean, nombre: string) {
    this.guardando = true;

    try {
      if (esEdicion && this.clienteEnEdicion?.id) {
        // Modo Edición
        await this.clienteService.updateCliente(this.clienteEnEdicion.id, {
          nombreCompleto: nombre,
          telefono: formVal.telefono?.trim() || '',
          email: formVal.email?.trim() || '',
          notas: formVal.notas?.trim() || '',
        });
        this.messageService.add({
          severity: 'success',
          summary: 'Cliente Actualizado',
          detail: `Datos del cliente "${nombre}" actualizados correctamente.`,
        });
      } else {
        // Modo Creación
        await this.clienteService.createCliente({
          nombreCompleto: nombre,
          telefono: formVal.telefono?.trim() || '',
          email: formVal.email?.trim() || '',
          notas: formVal.notas?.trim() || '',
          totalEventos: 0,
          creadoEn: new Date(),
        });
        this.messageService.add({
          severity: 'success',
          summary: 'Cliente Registrado',
          detail: `El cliente "${nombre}" se ha agregado al catálogo.`,
        });
      }

      this.ref.close(true);
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el cliente.',
      });
    } finally {
      this.guardando = false;
    }
  }

  cancelar() {
    this.ref.close(false);
  }
}
