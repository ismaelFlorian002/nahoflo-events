import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ScannerViewComponent } from '../components/scanner-view/scanner-view.component';
@Component({
  standalone: true,
  imports: [CommonModule, ScannerViewComponent],
  templateUrl: './recepcion.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class RecepcionPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
