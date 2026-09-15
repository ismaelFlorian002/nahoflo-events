import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Evento } from '../../../../core/models/event.model';
import { copiarAlPortapapeles } from '../../../../core/utils/clipboard.util';

@Component({
  selector: 'app-como-compartir-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './como-compartir-modal.component.html',
  styleUrl: './como-compartir-modal.component.scss',
})
export class ComoCompartirModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  evento = signal<Evento | null>(null);
  urlGeneral = signal<string>('');
  copiado = signal<boolean>(false);
  puedeCompartirNativo = signal<boolean>(false);

  ngOnInit(): void {
    const ev = this.config.data?.evento as Evento;
    if (ev) {
      this.evento.set(ev);
      const url = `${window.location.origin}/e/${ev.enlace}`;
      this.urlGeneral.set(url);
    }
    this.puedeCompartirNativo.set(typeof navigator !== 'undefined' && !!navigator.share);
  }

  async copiarEnlace(): Promise<void> {
    if (!this.urlGeneral()) return;
    await copiarAlPortapapeles(this.urlGeneral());
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2500);
  }

  compartirNativo(): void {
    if (!navigator.share || !this.urlGeneral()) return;
    const ev = this.evento();
    const titulo = ev?.titulo ? `Invitación a ${ev.titulo}` : 'Invitación al Evento';
    navigator
      .share({
        title: titulo,
        text: `¡Te invitamos a nuestro evento! Consulta los detalles y confirma aquí:`,
        url: this.urlGeneral(),
      })
      .catch(() => {});
  }

  cerrar(): void {
    this.ref.close();
  }
}
