import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  coincidenNombresInvitados,
  EventService,
  normalizarTelefonoInvitado,
} from '../../../../core/services/event.service';
import { EstadoInvitado, InvitadoModel } from '../../../../core/models/invitado.model';

@Component({
  selector: 'app-invitado-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: './invitado-form-modal.component.html',
  styleUrl: './invitado-form-modal.component.scss',
})
export class InvitadoFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  invitado?: InvitadoModel;
  eventoId!: string;
  invitadosExistentes: InvitadoModel[] = [];

  esEdicion = false;
  coincidenciaExistente = signal<InvitadoModel | null>(null);

  form!: FormGroup;
  guardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

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
      });
    } else {
      // Modo Creación: Inicializar con valores por defecto
      this.form = this.fb.group({
        nombre: ['', [Validators.required, Validators.minLength(2)]],
        telefono: [''],
        estado: ['pendiente' as EstadoInvitado, Validators.required],
        asistira: [false],
        pasesConfirmados: [1, [Validators.required, Validators.min(0)]],
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

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.eventoId) {
      this.errorMensaje.set('Identificador de evento no disponible.');
      return;
    }

    this.guardando.set(true);
    this.errorMensaje.set(null);

    try {
      const valores = this.form.value;
      const estado: EstadoInvitado = valores.estado;
      const asistira = estado === 'confirmado';

      if (this.esEdicion && this.invitado?.id) {
        // Actualizar invitado existente
        const datosActualizados: Partial<InvitadoModel> = {
          nombre: valores.nombre.trim(),
          asistira,
          estado,
          pasesConfirmados: Number(valores.pasesConfirmados) || (asistira ? 1 : 0),
          telefono: valores.telefono?.trim() || '',
          mensaje: this.invitado.mensaje || '',
        };

        await this.eventService.actualizarInvitado(this.eventoId, this.invitado.id, datosActualizados);
        this.ref.close({ guardado: true, datos: datosActualizados });
      } else {
        // Crear nuevo invitado (o actualizar coincidencia si fue detectada)
        const datosInvitado: Partial<InvitadoModel> = {
          nombre: valores.nombre.trim(),
          asistira,
          estado,
          pasesConfirmados: Number(valores.pasesConfirmados) || (asistira ? 1 : 0),
          telefono: valores.telefono?.trim() || '',
        };

        const match = this.coincidenciaExistente();
        if (match?.id) {
          await this.eventService.actualizarInvitado(this.eventoId, match.id, datosInvitado);
        } else {
          await this.eventService.agregarInvitado(
            this.eventoId,
            datosInvitado as Omit<InvitadoModel, 'id'>,
          );
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
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar(): void {
    this.ref.close(false);
  }
}
