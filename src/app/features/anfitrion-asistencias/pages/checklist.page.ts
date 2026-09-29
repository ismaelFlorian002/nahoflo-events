import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ChecklistTrackerComponent } from '../components/checklist-tracker/checklist-tracker.component';
@Component({
  standalone: true,
  imports: [CommonModule, ChecklistTrackerComponent],
  templateUrl: './checklist.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class ChecklistPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
