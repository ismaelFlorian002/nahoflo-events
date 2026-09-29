import { Component, inject } from '@angular/core';
import { PORTAL_CONTEXT } from '../portal-context';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './album.page.html',
  styleUrl: '../anfitrion-asistencias.component.scss',
})
export class AlbumPage {
  readonly vm = inject(PORTAL_CONTEXT);
}
