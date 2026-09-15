import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { RecuerdoModel } from '../../core/models/RecuerdoModel';
import { SubirFotoModalComponent } from './subir-foto-modal/subir-foto-modal.component';
import { RecuerdoPreviewComponent } from './recuerdo-preview/recuerdo-preview.component';
import { ComentariosModalComponent } from './comentarios-modal/comentarios-modal.component';

@Component({
  selector: 'app-album-digital',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, ProgressSpinnerModule],
  providers: [DialogService],
  templateUrl: './album-digital.component.html',
  styleUrl: './album-digital.component.scss',
})
export class AlbumDigitalComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);

  // Estados reactivos con Signals
  evento = signal<Evento | null>(null);
  recuerdos = signal<RecuerdoModel[]>([]);
  cargando = signal<boolean>(true);
  noDisponible = signal<boolean>(false);
  albumDesactivado = signal<boolean>(false);

  // Rastrea el índice de la foto activa en el carrusel de cada recuerdo
  indicesCarrusel = signal<Record<string, number>>({});

  // Almacena los IDs de las fotos a las que este invitado ya les dio like
  fotosConLike = signal<Set<string>>(new Set());

  // Almacena el ID de la foto que está mostrando la animación del corazón gigante
  corazonAnimandoId = signal<string | null>(null);

  // Rastrea el tiempo para detectar doble toque en móviles
  private ultimoTapTiempo = 0;

  // Modal ref
  private refModal: DynamicDialogRef | undefined;

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.cargando.set(false);
      this.noDisponible.set(true);
      return;
    }
    // <-- AGREGAR ESTE BLOQUE: Cargar likes previos de este dispositivo
    const likesGuardados = localStorage.getItem('nahoflo_likes_' + slug);
    if (likesGuardados) {
      try {
        this.fotosConLike.set(new Set(JSON.parse(likesGuardados)));
      } catch {
        // En caso de dato corrupto, continúa limpio
      }
    }

    try {
      const eventoData = await this.eventService.getEventBySlug(slug);
      if (!eventoData || !eventoData.id) {
        this.noDisponible.set(true);
      } else {
        this.evento.set(eventoData);

        // Verificar si el módulo de álbum está contratado/activo
        if (eventoData.modulos && !eventoData.modulos.tieneAlbum) {
          this.albumDesactivado.set(true);
        } else {
          await this.cargarRecuerdos(eventoData.id);
        }
      }
    } catch (error) {
      console.error('Error al cargar el álbum digital:', error);
      this.noDisponible.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarRecuerdos(eventoId: string): Promise<void> {
    try {
      const fotos = await this.eventService.getRecuerdos(eventoId);
      this.recuerdos.set(fotos);
    } catch (error) {
      console.error('Error al cargar recuerdos:', error);
    }
  }

  abrirModalSubirFoto(): void {
    const ev = this.evento();
    if (!ev?.id) return;

    this.refModal = this.dialogService.open(SubirFotoModalComponent, {
      header: 'Compartir un Recuerdo 📸',
      data: { eventoId: ev.id },
      width: '92%',
      style: { 'max-width': '460px' }, // <-- FORMA CORRECTA DE PRIMENG
      dismissableMask: true,
      modal: true,
    });
    // Cuando el modal se cierra exitosamente, recarga el muro en vivo
    this.refModal.onClose.subscribe((subidaExitosa: boolean) => {
      if (subidaExitosa && ev.id) {
        this.cargarRecuerdos(ev.id);
      }
    });
  }

  verFoto(recuerdo: RecuerdoModel): void {
    this.dialogService.open(RecuerdoPreviewComponent, {
      header: 'Recuerdo de la Fiesta ✨',
      data: { recuerdo },
      width: '100%',
      style: { 'max-width': '620px' },
      styleClass: 'modal-preview-dialog',
      dismissableMask: true,
      modal: true,
    });
  }

  obtenerFotos(recuerdo: RecuerdoModel): string[] {
    if (recuerdo.fotosUrls && recuerdo.fotosUrls.length > 0) {
      return recuerdo.fotosUrls;
    }
    return recuerdo.fotoUrl ? [recuerdo.fotoUrl] : [];
  }

  alDesplazarCarrusel(recuerdoId: string, event: Event): void {
    const elemento = event.target as HTMLElement;
    if (!elemento || !recuerdoId) return;
    const ancho = elemento.clientWidth;
    if (ancho > 0) {
      const nuevoIndice = Math.round(elemento.scrollLeft / ancho);
      if (this.indicesCarrusel()[recuerdoId] !== nuevoIndice) {
        this.indicesCarrusel.update((mapa) => ({ ...mapa, [recuerdoId]: nuevoIndice }));
      }
    }
  }

  navegarCarrusel(recuerdoId: string, contenedor: HTMLElement, delta: number, event: Event): void {
    event.stopPropagation();
    const recuerdo = this.recuerdos().find((r) => r.id === recuerdoId);
    const total = recuerdo ? this.obtenerFotos(recuerdo).length : 1;
    const actual = this.indicesCarrusel()[recuerdoId] || 0;
    const nuevo = Math.max(0, Math.min(actual + delta, total - 1));
    contenedor.scrollTo({ left: nuevo * contenedor.clientWidth, behavior: 'smooth' });
    this.indicesCarrusel.update((mapa) => ({ ...mapa, [recuerdoId]: nuevo }));
  }

  tieneLike(recuerdoId?: string): boolean {
    if (!recuerdoId) return false;
    return this.fotosConLike().has(recuerdoId);
  }

  async alternarLike(recuerdo: RecuerdoModel, event: Event): Promise<void> {
    // Evita abrir el modal de pantalla completa al tocar el corazón
    event.stopPropagation();

    const ev = this.evento();
    if (!ev?.id || !recuerdo.id) return;

    const recuerdoId = recuerdo.id;
    const yaTieneLike = this.tieneLike(recuerdoId);
    const delta = yaTieneLike ? -1 : 1;

    // 1. Actualización inmediata en memoria (Optimistic UI)
    const nuevoSet = new Set(this.fotosConLike());
    if (yaTieneLike) {
      nuevoSet.delete(recuerdoId);
    } else {
      nuevoSet.add(recuerdoId);
    }
    this.fotosConLike.set(nuevoSet);

    // Actualizar contador visual de la foto
    this.recuerdos.update((lista) =>
      lista.map((item) =>
        item.id === recuerdoId
          ? { ...item, meGusta: Math.max(0, (item.meGusta || 0) + delta) }
          : item,
      ),
    );

    // Guardar en el almacenamiento local del teléfono
    localStorage.setItem('nahoflo_likes_' + ev.enlace, JSON.stringify(Array.from(nuevoSet)));

    // 2. Persistir atómicamente en Firebase
    try {
      await this.eventService.alternarMeGusta(ev.id, recuerdoId, !yaTieneLike);
    } catch (error) {
      console.error('Error al actualizar like en Firebase:', error);
    }
  }

  alHacerDobleTap(recuerdo: RecuerdoModel, event: Event): void {
    event.stopPropagation();
    const ahora = Date.now();

    // Detecta doble clic nativo en PC o doble toque en pantalla táctil (< 350ms)
    if (event.type === 'dblclick' || ahora - this.ultimoTapTiempo < 350) {
      this.dispararLikeConCorazonGigante(recuerdo, event);
      this.ultimoTapTiempo = 0;
    } else {
      this.ultimoTapTiempo = ahora;
    }
  }

  private dispararLikeConCorazonGigante(recuerdo: RecuerdoModel, event: Event): void {
    // 1. Ejecuta el Me Gusta (sumar o restar)
    this.alternarLike(recuerdo, event);

    // 2. Si no tenía like y se activó, dispara la animación visual de Instagram
    if (recuerdo.id) {
      this.corazonAnimandoId.set(recuerdo.id);

      // Oculta el corazón flotante tras 800ms
      setTimeout(() => {
        if (this.corazonAnimandoId() === recuerdo.id) {
          this.corazonAnimandoId.set(null);
        }
      }, 800);
    }
  }
  abrirModalComentarios(recuerdo: RecuerdoModel, event: Event): void {
    event.stopPropagation();
    const ev = this.evento();
    if (!ev?.id) return;

    this.dialogService.open(ComentariosModalComponent, {
      data: { recuerdo, eventoId: ev.id },
      width: '100%',
      styleClass: 'cajon-comentarios-dialog', // <-- AGREGAR ESTA CLASE
      position: 'bottom',
      showHeader: false,
      dismissableMask: true,
      modal: true,
    });
  }
}
