import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { Evento } from '../../../../core/models/event.model';
import { copiarAlPortapapeles } from '../../../../core/utils/clipboard.util';

@Component({
  selector: 'app-whatsapp-mensaje-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextareaModule],
  templateUrl: './whatsapp-mensaje-modal.component.html',
  styleUrl: './whatsapp-mensaje-modal.component.scss',
})
export class WhatsappMensajeModalComponent implements OnInit {
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private messageService = inject(MessageService);

  invitado!: InvitadoModel;
  evento!: Evento;
  mensajeTexto: string = '';

  ngOnInit(): void {
    const data = this.config.data || {};
    this.invitado = data.invitado;
    this.evento = data.evento;
    this.mensajeTexto = data.mensaje || '';
  }

  async copiarTexto(): Promise<void> {
    if (!this.mensajeTexto) return;
    await copiarAlPortapapeles(this.mensajeTexto);
    this.messageService.add({
      severity: 'success',
      summary: 'Mensaje Copiado',
      detail: `Texto personalizado para ${this.invitado.nombre} copiado al portapapeles.`,
    });
  }

  enviarWhatsApp(): void {
    const telefonoLimpio = (this.invitado.telefono || '').replace(/\D/g, '');
    const urlWa =
      telefonoLimpio && telefonoLimpio.length >= 10
        ? `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(this.mensajeTexto)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(this.mensajeTexto)}`;

    window.open(urlWa, '_blank');
  }
}
