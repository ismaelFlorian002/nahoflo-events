import { Component, computed, inject, signal } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { RecuerdoModel } from '../../../core/models/RecuerdoModel';
import { RecuerdoPreviewModalComponent } from '../components/recuerdo-preview-modal/recuerdo-preview-modal.component';

@Component({
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './album.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class AlbumPage {
  readonly vm = inject(PORTAL_CONTEXT);
  private dialogService = inject(DialogService);

  private readonly indices = signal<Record<string, number>>({});

  readonly totalMeGusta = computed(() =>
    this.vm.recuerdos().reduce((acc, r) => acc + (r.meGusta || 0), 0),
  );
  readonly totalComentarios = computed(() =>
    this.vm.recuerdos().reduce((acc, r) => acc + (r.comentarios?.length || 0), 0),
  );

  fotosDe(recuerdo: RecuerdoModel): string[] {
    if (recuerdo.fotosUrls?.length) return recuerdo.fotosUrls;
    return recuerdo.fotoUrl ? [recuerdo.fotoUrl] : [];
  }

  indiceDe(recuerdo: RecuerdoModel): number {
    const total = this.fotosDe(recuerdo).length;
    const i = this.indices()[recuerdo.id ?? ''] ?? 0;
    return total > 0 ? Math.min(i, total - 1) : 0;
  }

  moverFoto(recuerdo: RecuerdoModel, delta: number, event?: Event): void {
    event?.stopPropagation();
    const total = this.fotosDe(recuerdo).length;
    if (total < 2) return;
    const siguiente = (this.indiceDe(recuerdo) + delta + total) % total;
    this.indices.update((m) => ({ ...m, [recuerdo.id ?? '']: siguiente }));
  }

  abrirVistaPrevia(recuerdo: RecuerdoModel): void {
    const ref = this.dialogService.open(RecuerdoPreviewModalComponent, {
      header: 'Recuerdo de ' + (recuerdo.nombreAutor || 'invitado'),
      width: '1000px',
      breakpoints: { '1060px': '96vw' },
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      draggable: false,
      focusOnShow: false,
      data: { recuerdo, indice: this.indiceDe(recuerdo) },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.accion === 'eliminar') this.vm.eliminarRecuerdo(recuerdo);
    });
  }
}
