import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBarModule],
  templateUrl: './resumen.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class ResumenPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
