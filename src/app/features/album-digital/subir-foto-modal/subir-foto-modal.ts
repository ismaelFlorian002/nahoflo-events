import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { EventService } from '../../../core/services/event.service';

@Component({
  selector: 'app-subir-foto-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputTextareaModule],
  templateUrl: './subir-foto-modal.html',
  styleUrl: './subir-foto-modal.scss',
})
export class SubirFotoModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  eventoId = '';
  archivoFoto: File | null = null;
  previewUrl = signal<string | null>(null);
  subiendo = signal<boolean>(false);
  errorSubida = signal<string | null>(null);

  formRecuerdo = this.fb.group({
    nombreAutor: ['', [Validators.required, Validators.minLength(2)]],
    mensaje: [''],
  });

  ngOnInit(): void {
    this.eventoId = this.config.data?.eventoId || '';
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const archivo = input.files[0];

      // Validación simple de tipo imagen
      if (!archivo.type.startsWith('image/')) {
        this.errorSubida.set('Por favor selecciona un archivo de imagen válido.');
        return;
      }

      this.archivoFoto = archivo;
      this.errorSubida.set(null);

      // Crear URL local para previsualizar al instante
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(archivo);
    }
  }

  removerFoto(): void {
    this.archivoFoto = null;
    this.previewUrl.set(null);
  }

  async publicarFoto(): Promise<void> {
    if (this.formRecuerdo.invalid || !this.archivoFoto || !this.eventoId || this.subiendo()) {
      return;
    }

    this.subiendo.set(true);
    this.errorSubida.set(null);

    try {
      const { nombreAutor, mensaje } = this.formRecuerdo.value;
      await this.eventService.guardarRecuerdo(
        this.eventoId,
        this.archivoFoto,
        nombreAutor!,
        mensaje || '',
      );

      // Cerrar modal devolviendo 'true' para refrescar el muro
      this.ref.close(true);
    } catch (error) {
      console.error('Error al subir recuerdo:', error);
      this.errorSubida.set('Ocurrió un error al subir la foto. Intenta de nuevo.');
    } finally {
      this.subiendo.set(false);
    }
  }
}
