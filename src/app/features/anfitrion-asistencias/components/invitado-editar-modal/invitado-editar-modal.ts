import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EventService } from '../../../../core/services/event.service';
import { EstadoInvitado, InvitadoModel } from '../../../../core/models/invitado.model';

@Component({
  selector: 'app-invitado-editar-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: './invitado-editar-modal.html',
  styleUrl: './invitado-editar-modal.scss',
})
export class InvitadoEditarModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  invitado!: InvitadoModel;
  eventoId!: string;

  form!: FormGroup;
  guardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  ngOnInit(): void {
    this.invitado = this.config.data?.invitado;
    this.eventoId = this.config.data?.eventoId;

    if (!this.invitado) {
      this.ref.close(false);
      return;
    }

    const estadoInicial: EstadoInvitado =
      this.invitado.estado || (this.invitado.asistira ? 'confirmado' : 'declinado');

    this.form = this.fb.group({
      nombre: [this.invitado.nombre || '', [Validators.required, Validators.minLength(2)]],
      estado: [estadoInicial, Validators.required],
      asistira: [this.invitado.asistira ?? true],
      pasesConfirmados: [
        this.invitado.pasesConfirmados ?? 1,
        [Validators.required, Validators.min(0)],
      ],
      telefono: [this.invitado.telefono || ''],
    });
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
    const min = this.form.get('estado')?.value === 'declinado' ? 0 : 1;
    const nuevo = Math.max(min, actual + delta);
    this.form.patchValue({ pasesConfirmados: nuevo });
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.eventoId || !this.invitado?.id) {
      this.errorMensaje.set('Identificador de evento o invitado no disponible.');
      return;
    }

    this.guardando.set(true);
    this.errorMensaje.set(null);

    try {
      const valores = this.form.value;
      const estado: EstadoInvitado = valores.estado;
      const asistira = estado === 'confirmado';

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
    } catch (err: any) {
      console.error('Error al actualizar invitado:', err);
      this.errorMensaje.set('Ocurrió un error al guardar los cambios. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar(): void {
    this.ref.close(false);
  }
}
