import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Evento } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';

@Component({
  selector: 'app-agencia-branding-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: './agencia-branding-modal.component.html',
  styleUrl: './agencia-branding-modal.component.scss',
})
export class AgenciaBrandingModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  form!: FormGroup;
  evento!: Evento;
  guardando = false;

  ngOnInit(): void {
    this.evento = this.config.data?.evento;

    this.form = this.fb.group({
      agenciaNombre: [this.evento?.agenciaNombre || ''],
      agenciaTelefono: [this.evento?.agenciaTelefono || ''],
      agenciaLogoUrl: [this.evento?.agenciaLogoUrl || ''],
      agenciaNotas: [this.evento?.agenciaNotas || ''],
    });
  }

  async guardar(): Promise<void> {

    if (!this.evento?.id) return;
    this.guardando = true;

    const val = this.form.value;
    const datosAgencia = {
      agenciaNombre: val.agenciaNombre?.trim() || '',
      agenciaTelefono: val.agenciaTelefono?.trim() || '',
      agenciaLogoUrl: val.agenciaLogoUrl?.trim() || '',
      agenciaNotas: val.agenciaNotas?.trim() || '',
    };

    try {
      await this.eventService.actualizarDatosAgencia(this.evento.id, datosAgencia);
      this.ref.close({ guardado: true, datosAgencia });
    } catch (err) {
      console.error('Error al guardar datos de la agencia:', err);
    } finally {
      this.guardando = false;
    }
  }

  cancelar(): void {
    this.ref.close();
  }
}
