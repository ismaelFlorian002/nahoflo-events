import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';
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
    FileUploadModule,
    TooltipModule,
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

  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  ngOnInit(): void {
    this.evento = this.config.data?.evento;

    this.form = this.fb.group({
      agenciaNombre: [this.evento?.agenciaNombre || ''],
      agenciaTelefono: [this.evento?.agenciaTelefono || ''],
      agenciaLogoUrl: [this.evento?.agenciaLogoUrl || ''],
      agenciaNotas: [this.evento?.agenciaNotas || ''],
    });

    if (this.evento?.agenciaLogoUrl) {
      this.logoPreviewUrl = this.evento.agenciaLogoUrl;
    }
  }

  onLogoSelected(event: any): void {
    if (event.files && event.files.length > 0) {
      const file: File = event.files[0];
      this.logoFile = file;
      this.logoPreviewUrl = URL.createObjectURL(file);
    }
  }

  removerLogo(): void {
    this.logoFile = null;
    this.logoPreviewUrl = null;
    this.form.patchValue({ agenciaLogoUrl: '' });
  }

  async guardar(): Promise<void> {
    if (!this.evento?.id) return;
    this.guardando = true;

    try {
      let finalLogoUrl = this.form.value.agenciaLogoUrl || '';

      // Si el usuario subió un archivo nuevo, subirlo a Firebase Storage
      if (this.logoFile) {
        finalLogoUrl = await this.eventService.uploadImage(
          this.logoFile,
          'eventos/agencias/logos',
        );
      }

      const val = this.form.value;
      const datosAgencia = {
        agenciaNombre: val.agenciaNombre?.trim() || '',
        agenciaTelefono: val.agenciaTelefono?.trim() || '',
        agenciaLogoUrl: finalLogoUrl,
        agenciaNotas: val.agenciaNotas?.trim() || '',
      };

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

