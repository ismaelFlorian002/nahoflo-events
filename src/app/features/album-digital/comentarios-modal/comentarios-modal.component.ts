import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { EventService } from '../../../core/services/event.service';
import { ComentarioModel, RecuerdoModel } from '../../../core/models/RecuerdoModel';

@Component({
  selector: 'app-comentarios-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './comentarios-modal.component.html',
  styleUrl: './comentarios-modal.component.scss',
})
export class ComentariosModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  recuerdo: RecuerdoModel = this.config.data?.recuerdo;
  eventoId: string = this.config.data?.eventoId || '';

  // Emojis rápidos de fiesta estilo Instagram
  emojisRapidos = ['❤️', '🎉', '🔥', '🥂', '👏', '😍', '🥳', '😂'];

  comentarios = signal<ComentarioModel[]>([]);
  enviando = signal<boolean>(false);

  // Rastrea a quién se está respondiendo actualmente
  respondiendoA = signal<{ id: string; autor: string } | null>(null);

  // Almacena los IDs de los comentarios a los que este usuario les dio like
  likesComentarios = signal<Set<string>>(new Set());

  formComentario = this.fb.group({
    autor: ['', [Validators.required, Validators.minLength(2)]],
    texto: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    if (this.recuerdo?.comentarios) {
      this.comentarios.set(this.recuerdo.comentarios);
    }

    // Auto-recordar el nombre del invitado
    const nombreGuardado = localStorage.getItem('nahoflo_invitado_nombre');
    if (nombreGuardado) {
      this.formComentario.patchValue({ autor: nombreGuardado });
    }

    // Cargar likes de comentarios guardados en este dispositivo
    const likesGuardados = localStorage.getItem('nahoflo_comentarios_likes');
    if (likesGuardados) {
      try {
        this.likesComentarios.set(new Set(JSON.parse(likesGuardados)));
      } catch {
        // Ignorar si hay error de parseo
      }
    }
  }

  insertarEmoji(emoji: string): void {
    const textoActual = this.formComentario.get('texto')?.value || '';
    this.formComentario.patchValue({ texto: textoActual + emoji });
  }

  prepararRespuesta(comentario: ComentarioModel, event: Event): void {
    event.stopPropagation();
    this.respondiendoA.set({ id: comentario.id, autor: comentario.autor });

    // Pone el foco en el input automáticamente
    const inputTexto = document.getElementById('inputComentarioTexto');
    if (inputTexto) {
      inputTexto.focus();
    }
  }

  cancelarRespuesta(): void {
    this.respondiendoA.set(null);
  }

  tieneLikeComentario(id: string): boolean {
    return this.likesComentarios().has(id);
  }

  async alternarLikeComentario(
    comentarioId: string,
    idPadre?: string,
    event?: Event,
  ): Promise<void> {
    if (event) event.stopPropagation();

    const yaTiene = this.tieneLikeComentario(comentarioId);
    const delta = yaTiene ? -1 : 1;

    // 1. Actualización en memoria del Set de likes locales
    const nuevoSet = new Set(this.likesComentarios());
    if (yaTiene) {
      nuevoSet.delete(comentarioId);
    } else {
      nuevoSet.add(comentarioId);
    }
    this.likesComentarios.set(nuevoSet);
    localStorage.setItem('nahoflo_comentarios_likes', JSON.stringify(Array.from(nuevoSet)));

    // 2. Actualización optimista en el árbol de comentarios
    this.comentarios.update((lista) => {
      if (idPadre) {
        // Es un like a una respuesta anidada
        return lista.map((padre) => {
          if (padre.id === idPadre && padre.respuestas) {
            const respuestasActualizadas = padre.respuestas.map((hijo) =>
              hijo.id === comentarioId
                ? { ...hijo, meGusta: Math.max(0, (hijo.meGusta || 0) + delta) }
                : hijo,
            );
            return { ...padre, respuestas: respuestasActualizadas };
          }
          return padre;
        });
      } else {
        // Es un like a un comentario principal
        return lista.map((comentario) =>
          comentario.id === comentarioId
            ? { ...comentario, meGusta: Math.max(0, (comentario.meGusta || 0) + delta) }
            : comentario,
        );
      }
    });

    // 3. Persistir en Firebase
    if (this.eventoId && this.recuerdo?.id) {
      try {
        await this.eventService.actualizarComentariosRecuerdo(
          this.eventoId,
          this.recuerdo.id,
          this.comentarios(),
        );
        this.recuerdo.comentarios = this.comentarios();
      } catch (error) {
        console.error('Error al actualizar like del comentario:', error);
      }
    }
  }

  async enviarComentario(): Promise<void> {
    if (this.formComentario.invalid || !this.recuerdo?.id || !this.eventoId || this.enviando()) {
      return;
    }

    this.enviando.set(true);

    try {
      const { autor, texto } = this.formComentario.value;
      localStorage.setItem('nahoflo_invitado_nombre', autor!.trim());

      const objetivoRespuesta = this.respondiendoA();

      if (objetivoRespuesta) {
        // ES UNA RESPUESTA ANIDADA A OTRO COMENTARIO
        const nuevaRespuesta: ComentarioModel = {
          id: Date.now().toString(),
          autor: autor!.trim(),
          texto: texto!.trim(),
          creadoEn: new Date(),
          meGusta: 0,
          respondiendoA: objetivoRespuesta.autor,
        };

        this.comentarios.update((lista) =>
          lista.map((c) => {
            if (c.id === objetivoRespuesta.id) {
              const respuestas = c.respuestas
                ? [...c.respuestas, nuevaRespuesta]
                : [nuevaRespuesta];
              return { ...c, respuestas };
            }
            return c;
          }),
        );
      } else {
        // ES UN COMENTARIO PRINCIPAL NUEVO
        const nuevoComentario: ComentarioModel = {
          id: Date.now().toString(),
          autor: autor!.trim(),
          texto: texto!.trim(),
          creadoEn: new Date(),
          meGusta: 0,
          respuestas: [],
        };

        this.comentarios.update((lista) => [...lista, nuevoComentario]);
      }

      // Persistir toda la estructura en Firebase
      await this.eventService.actualizarComentariosRecuerdo(
        this.eventoId,
        this.recuerdo.id,
        this.comentarios(),
      );

      this.recuerdo.comentarios = this.comentarios();

      // Limpiar texto y estado de respuesta
      this.formComentario.get('texto')?.reset();
      this.cancelarRespuesta();
    } catch (error) {
      console.error('Error al enviar comentario:', error);
    } finally {
      this.enviando.set(false);
    }
  }
}
