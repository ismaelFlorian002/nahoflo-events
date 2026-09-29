import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { CroquisMesasDesignerComponent } from '../components/croquis-mesas-designer/croquis-mesas-designer.component';
@Component({
  standalone: true,
  imports: [CommonModule, CroquisMesasDesignerComponent],
  templateUrl: './croquis.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class CroquisPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
