import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { PresupuestoTrackerComponent } from '../components/presupuesto-tracker/presupuesto-tracker.component';
@Component({
  standalone: true,
  imports: [CommonModule, PresupuestoTrackerComponent],
  templateUrl: './presupuesto.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class PresupuestoPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
