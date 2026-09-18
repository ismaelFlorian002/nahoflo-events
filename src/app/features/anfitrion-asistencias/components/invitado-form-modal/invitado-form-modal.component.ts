import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  coincidenNombresInvitados,
  EventService,
  normalizarTelefonoInvitado,
} from '../../../../core/services/event.service';
import { EstadoInvitado, InvitadoModel } from '../../../../core/models/invitado.model';

import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-invitado-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    FloatLabelModule,
  ],
  templateUrl: './invitado-form-modal.component.html',
  styleUrl: './invitado-form-modal.component.scss',
})
export class InvitadoFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  invitado?: InvitadoModel;
  eventoId!: string;
  invitadosExistentes: InvitadoModel[] = [];

  esEdicion = false;
  coincidenciaExistente = signal<InvitadoModel | null>(null);

  form!: FormGroup;
  guardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  opcionesMenu = [
    { label: 'Adulto (Estándar)', value: 'Adulto' },
    { label: 'Infantil', value: 'Infantil' },
    { label: 'Vegetariano', value: 'Vegetariano' },
    { label: 'Vegano', value: 'Vegano' },
    { label: 'Especial / Diabético', value: 'Especial' },
  ];

  ngOnInit(): void {
    this.invitado = this.config.data?.invitado;
    this.eventoId = this.config.data?.eventoId;
    this.invitadosExistentes = this.config.data?.invitadosExistentes || [];

    if (!this.eventoId) {
      this.ref.close(false);
      return;
    }

    this.esEdicion = !!this.invitado;

    if (this.esEdicion && this.invitado) {
      // Modo Edición: Precargar datos del invitado existente
      const estadoInicial: EstadoInvitado =
        this.invitado.estado || (this.invitado.asistira ? 'confirmado' : 'declinado');

      this.form = this.fb.group({
        nombre: [this.invitado.nombre || '', [Validators.required, Validators.minLength(2)]],
        telefono: [this.invitado.telefono || ''],
        estado: [estadoInicial, Validators.required],
        asistira: [this.invitado.asistira ?? true],
        pasesConfirmados: [
          this.invitado.pasesConfirmados ?? 1,
          [Validators.required, Validators.min(0)],
        ],
        mesa: [this.invitado.mesa || ''],
        tipoMenu: [this.invitado.tipoMenu || 'Adulto'],
        restriccionesAlimentarias: [this.invitado.restriccionesAlimentarias || ''],
      });
    } else {
      // Modo Creación: Inicializar con valores por defecto
      this.form = this.fb.group({
        nombre: ['', [Validators.required, Validators.minLength(2)]],
        telefono: [''],
        estado: ['pendiente' as EstadoInvitado, Validators.required],
        asistira: [false],
        pasesConfirmados: [1, [Validators.required, Validators.min(0)]],
        mesa: [''],
        tipoMenu: ['Adulto'],
        restriccionesAlimentarias: [''],
      });

      this.form.valueChanges.subscribe((val) => {
        this.verificarCoincidencia(val.nombre, val.telefono);
      });
    }
  }

  private verificarCoincidencia(nombre?: string, telefono?: string): void {
    if (this.esEdicion || !this.invitadosExistentes?.length) {
      this.coincidenciaExistente.set(null);
      return;
    }

    const telCorto = normalizarTelefonoInvitado(telefono || '');
    const nom = (nombre || '').trim();

    const encontrado = this.invitadosExistentes.find((inv) => {
      if (telCorto.length >= 7) {
        const invTelCorto = normalizarTelefonoInvitado(inv.telefono || '');
        if (invTelCorto.length >= 7 && invTelCorto === telCorto) return true;
      }
      if (nom.length >= 2) {
        if (coincidenNombresInvitados(inv.nombre || '', nom)) return true;
      }
      return false;
    });

    this.coincidenciaExistente.set(encontrado || null);
  }

  cambiarEstado(nuevoEstado: EstadoInvitado): void {
    const asiste = nuevoEstado === 'confirmado';
    this.form.patchValue({ estado: nuevoEstado, asistira: asiste });
    if (nuevoEstado === 'declinado') {
      this.form.patchValue({ pasesConfirmados: 0 });
    } else if (this.form.get('pasesConfirmados')?.value < 1) {
      this.form.patchValue({ pasesConfirmados: 1 });
    }
  }

  cambiarPases(delta: number): void {
    const actual = Number(this.form.get('pasesConfirmados')?.value) || 0;
    const estado = this.form.get('estado')?.value;
    const min = estado === 'declinado' ? 0 : 1;
    const nuevo = Math.max(min, actual + delta);
    this.form.patchValue({ pasesConfirmados: nuevo });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor ingresa un nombre válido para el invitado.',
      });
      return;
    }

    if (!this.eventoId) {
      this.errorMensaje.set('Identificador de evento no disponible.');
      return;
    }

    const nombre = (this.form.value.nombre || '').trim();
    const header = this.esEdicion ? 'Confirmar Edición' : 'Confirmar Invitado';
    const message = this.esEdicion
      ? `¿Deseas guardar las modificaciones para "${nombre}"?`
      : `¿Deseas registrar a "${nombre}" en la lista de invitados?`;

    this.confirmationService.confirm({
      header,
      message,
      icon: 'pi pi-user-plus text-gold-500',
      acceptLabel: this.esEdicion ? 'Guardar Cambios' : 'Registrar Invitado',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'bg-gold-500 hover:bg-gold-600 text-white border-0',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        await this.ejecutarGuardadoInvitado(nombre);
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se guardó el invitado.',
        });
      },
    });
  }

  private async ejecutarGuardadoInvitado(nombre: string): Promise<void> {
    this.guardando.set(true);
    this.errorMensaje.set(null);

    try {
      const valores = this.form.value;
      const estado: EstadoInvitado = valores.estado;
      const asistira = estado === 'confirmado';

      if (this.esEdicion && this.invitado?.id) {
        // Actualizar invitado existente
        const datosActualizados: Partial<InvitadoModel> = {
          nombre: nombre,
          asistira,
          estado,
          pasesConfirmados: Number(valores.pasesConfirmados) || (asistira ? 1 : 0),
          telefono: valores.telefono?.trim() || '',
          mensaje: this.invitado.mensaje || '',
          mesa: valores.mesa?.trim() || '',
          tipoMenu: valores.tipoMenu?.trim() || '',
          restriccionesAlimentarias: valores.restriccionesAlimentarias?.trim() || '',
        };

        await this.eventService.actualizarInvitado(this.eventoId, this.invitado.id, datosActualizados);
        this.messageService.add({
          severity: 'success',
          summary: 'Invitado Actualizado',
          detail: `Los datos de "${nombre}" fueron actualizados exitosamente.`,
        });
        this.ref.close({ guardado: true, datos: datosActualizados });
      } else {
        // Crear nuevo invitado (o actualizar coincidencia si fue detectada)
        const datosInvitado: Partial<InvitadoModel> = {
          nombre: nombre,
          asistira,
          estado,
          pasesConfirmados: Number(valores.pasesConfirmados) || (asistira ? 1 : 0),
          telefono: valores.telefono?.trim() || '',
          mesa: valores.mesa?.trim() || '',
          tipoMenu: valores.tipoMenu?.trim() || '',
          restriccionesAlimentarias: valores.restriccionesAlimentarias?.trim() || '',
        };

        const match = this.coincidenciaExistente();
        if (match?.id) {
          await this.eventService.actualizarInvitado(this.eventoId, match.id, datosInvitado);
          this.messageService.add({
            severity: 'success',
            summary: 'Invitado Sincronizado',
            detail: `Se actualizó el registro existente de "${nombre}".`,
          });
        } else {
          await this.eventService.agregarInvitado(
            this.eventoId,
            datosInvitado as Omit<InvitadoModel, 'id'>,
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Invitado Registrado',
            detail: `"${nombre}" fue agregado a la lista de invitados.`,
          });
        }

        this.ref.close({ guardado: true });
      }
    } catch (err: any) {
      console.error('Error al agregar/actualizar invitado:', err);
      this.errorMensaje.set(
        this.esEdicion
          ? 'Ocurrió un error al guardar los cambios. Intenta nuevamente.'
          : 'Ocurrió un error al registrar el invitado. Intenta nuevamente.',
      );
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el invitado.',
      });
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar(): void {
    this.ref.close(false);
  }
}
