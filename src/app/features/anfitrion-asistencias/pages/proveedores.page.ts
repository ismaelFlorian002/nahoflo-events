import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ProveedoresDirectorioComponent } from '../components/proveedores-directorio/proveedores-directorio.component';
@Component({
  standalone: true,
  imports: [CommonModule, ProveedoresDirectorioComponent],
  templateUrl: './proveedores.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class ProveedoresPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
