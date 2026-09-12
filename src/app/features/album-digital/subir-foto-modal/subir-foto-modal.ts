import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { EventService } from '../../../core/services/event.service';
import { comprimirImagen } from '../../../core/utils/image-compresor';

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

  // Arreglo de archivos y sus previsualizaciones para el carrusel
  archivosFotos = signal<File[]>([]);
  previewsUrls = signal<string[]>([]);
  subiendo = signal<boolean>(false);
  errorSubida = signal<string | null>(null);

  formRecuerdo = this.fb.group({
    nombreAutor: ['', [Validators.required, Validators.minLength(2)]],
    mensaje: [''],
  });

  ngOnInit(): void {
    this.eventoId = this.config.data?.eventoId || '';

    // Auto-recordar el nombre del invitado
    const nombreGuardado = localStorage.getItem('nahoflo_invitado_nombre');
    if (nombreGuardado) {
      this.formRecuerdo.patchValue({ nombreAutor: nombreGuardado });
    }
  }

  async onFotosSeleccionadas(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const archivosCrudos = Array.from(input.files).filter((a) => a.type.startsWith('image/'));

    if (archivosCrudos.length === 0) {
      this.errorSubida.set('Selecciona únicamente archivos de imagen válidos.');
      return;
    }

    this.errorSubida.set(null);

    // Comprime las fotos en paralelo en el celular antes de agregarlas
    const promesasCompresion = archivosCrudos.map((archivo) => comprimirImagen(archivo));
    const archivosOptimizados = await Promise.all(promesasCompresion);

    const nuevasUrls = archivosOptimizados.map((archivo) => URL.createObjectURL(archivo));

    this.archivosFotos.update((prev) => [...prev, ...archivosOptimizados]);
    this.previewsUrls.update((prev) => [...prev, ...nuevasUrls]);

    input.value = '';
  }
  removerFoto(index: number): void {
    this.archivosFotos.update((lista) => lista.filter((_, i) => i !== index));
    this.previewsUrls.update((lista) => lista.filter((_, i) => i !== index));
  }

  async publicarCarrusel(): Promise<void> {
    if (
      this.formRecuerdo.invalid ||
      this.archivosFotos().length === 0 ||
      !this.eventoId ||
      this.subiendo()
    ) {
      return;
    }

    this.subiendo.set(true);
    this.errorSubida.set(null);

    try {
      const { nombreAutor, mensaje } = this.formRecuerdo.value;

      // Guardar nombre en el teléfono
      localStorage.setItem('nahoflo_invitado_nombre', nombreAutor!.trim());

      // Guardar todas las fotos en Firebase
      await this.eventService.guardarRecuerdo(
        this.eventoId,
        this.archivosFotos(),
        nombreAutor!,
        mensaje || '',
      );

      this.ref.close(true);
    } catch (error: any) {
      console.error('Error al subir carrusel de recuerdos:', error);
      this.errorSubida.set(
        error?.message || 'Ocurrió un error al subir las fotos. Intenta de nuevo.',
      );
    } finally {
      this.subiendo.set(false);
    }
  }
}
