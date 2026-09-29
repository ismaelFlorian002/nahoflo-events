import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { MinutarioTimelineComponent } from '../components/minutario-timeline/minutario-timeline.component';
@Component({
  standalone: true,
  imports: [CommonModule, MinutarioTimelineComponent],
  templateUrl: './minutario.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class MinutarioPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
