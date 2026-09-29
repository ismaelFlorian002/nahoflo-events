import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { WhatsappMessagingCenterComponent } from '../components/whatsapp-messaging-center/whatsapp-messaging-center.component';
@Component({
  standalone: true,
  imports: [CommonModule, WhatsappMessagingCenterComponent],
  templateUrl: './whatsapp.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class WhatsappPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
