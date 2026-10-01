import { Component, computed, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { KnobModule } from 'primeng/knob';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, ProgressBarModule, TooltipModule, KnobModule],
  templateUrl: './resumen.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class ResumenPage {
  readonly vm = inject(PORTAL_CONTEXT);

  readonly fotosRecientes = computed(() =>
    this.vm
      .recuerdos()
      .flatMap((r) => (r.fotosUrls?.length ? r.fotosUrls : r.fotoUrl ? [r.fotoUrl] : []))
      .slice(0, 6),
  );

  porcentaje(valor: number, total: number): number {
    return total > 0 ? Math.round((valor / total) * 100) : 0;
  }
}
