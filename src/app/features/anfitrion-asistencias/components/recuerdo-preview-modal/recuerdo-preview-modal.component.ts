import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ComentarioModel, RecuerdoModel } from '../../../../core/models/RecuerdoModel';
import { ZipDownloaderService } from '../../services/zip-downloader.service';

@Component({
  selector: 'app-recuerdo-preview-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './recuerdo-preview-modal.component.html',
})
export class RecuerdoPreviewModalComponent {
  private config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private zipDownloaderService = inject(ZipDownloaderService);

  readonly recuerdo: RecuerdoModel = this.config.data?.recuerdo;
  readonly fotos: string[] = this.recuerdo?.fotosUrls?.length
    ? this.recuerdo.fotosUrls
    : this.recuerdo?.fotoUrl
      ? [this.recuerdo.fotoUrl]
      : [];

  readonly indice = signal<number>(
    Math.min(Math.max(this.config.data?.indice ?? 0, 0), Math.max(this.fotos.length - 1, 0)),
  );
  readonly fotoActual = computed(() => this.fotos[this.indice()] ?? '');
  readonly descargando = signal<boolean>(false);
  readonly totalComentarios = this.contarComentarios(this.recuerdo?.comentarios ?? []);

  private touchInicioX: number | null = null;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.mover(-1);
    if (event.key === 'ArrowRight') this.mover(1);
  }

  mover(delta: number): void {
    const total = this.fotos.length;
    if (total < 2) return;
    this.indice.set((this.indice() + delta + total) % total);
  }

  irA(i: number): void {
    this.indice.set(i);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchInicioX = event.changedTouches[0]?.clientX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchInicioX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? this.touchInicioX) - this.touchInicioX;
    if (Math.abs(delta) > 40) this.mover(delta < 0 ? 1 : -1);
    this.touchInicioX = null;
  }

  async descargar(): Promise<void> {
    this.descargando.set(true);
    try {
      await this.zipDownloaderService.descargarRecuerdo(this.recuerdo);
    } finally {
      this.descargando.set(false);
    }
  }

  eliminar(): void {
    this.ref.close({ accion: 'eliminar' });
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private contarComentarios(lista: ComentarioModel[]): number {
    return lista.reduce((acc, c) => acc + 1 + this.contarComentarios(c.respuestas ?? []), 0);
  }
}
