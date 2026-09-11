import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ComentarioModel, RecuerdoModel } from '../../../core/models/RecuerdoModel';
import { EventService } from '../../../core/services/event.service';

@Component({
  selector: 'app-recuerdo-preview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './recuerdo-preview.html',
  styleUrl: './recuerdo-preview.scss',
})
export class RecuerdoPreviewComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  recuerdo: RecuerdoModel = this.config.data?.recuerdo;
  eventoId: string = this.config.data?.eventoId || '';

  // Signal reactiva para la lista de comentarios
  comentarios = signal<ComentarioModel[]>([]);
  enviando = signal<boolean>(false);

  formComentario = this.fb.group({
    autor: ['', [Validators.required, Validators.minLength(2)]],
    texto: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    if (this.recuerdo?.comentarios) {
      this.comentarios.set(this.recuerdo.comentarios);
    }

    // Auto-recordar el nombre del invitado si ya comentó o subió foto antes
    const nombreGuardado = localStorage.getItem('nahoflo_invitado_nombre');
    if (nombreGuardado) {
      this.formComentario.patchValue({ autor: nombreGuardado });
    }
  }

  async enviarComentario(): Promise<void> {
    if (this.formComentario.invalid || !this.recuerdo?.id || !this.eventoId || this.enviando()) {
      return;
    }

    this.enviando.set(true);

    try {
      const { autor, texto } = this.formComentario.value;

      // 1. Guardar el nombre en el celular para futuras interacciones
      localStorage.setItem('nahoflo_invitado_nombre', autor!.trim());

      // 2. Guardar en Firebase con arrayUnion
      const nuevo = await this.eventService.agregarComentario(
        this.eventoId,
        this.recuerdo.id,
        autor!,
        texto!,
      );

      // 3. Actualizar la lista en pantalla al instante
      this.comentarios.update((lista) => [...lista, nuevo]);

      // 4. Sincronizar el objeto original del recuerdo
      if (!this.recuerdo.comentarios) {
        this.recuerdo.comentarios = [];
      }
      this.recuerdo.comentarios.push(nuevo);

      // 5. Limpiar solo el texto del mensaje (conservando el nombre)
      this.formComentario.get('texto')?.reset();
    } catch (error) {
      console.error('Error al enviar comentario:', error);
    } finally {
      this.enviando.set(false);
    }
  }
}
