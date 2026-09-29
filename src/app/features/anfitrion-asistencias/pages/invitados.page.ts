import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { GuestTableComponent } from '../components/guest-table/guest-table.component';
@Component({
  standalone: true,
  imports: [CommonModule, GuestTableComponent],
  templateUrl: './invitados.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class InvitadosPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
