import { Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import QRCode from 'qrcode';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { Evento } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { capturarYDescargarTarjetaPaseWeb } from '../../../../core/utils/image-compresor';

@Component({
  selector: 'app-invitado-qr-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './invitado-qr-modal.component.html',
  styleUrl: './invitado-qr-modal.component.scss',
})
export class InvitadoQrModalComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private eventService = inject(EventService);

  @ViewChild('cardPaseRef') cardPaseRef!: ElementRef<HTMLElement>;

  invitado!: InvitadoModel;
  evento!: Evento;
  qrDataUrl = signal<string>('');
  pases = signal<number>(1);
  cargandoQr = signal<boolean>(true);
  guardandoPases = signal<boolean>(false);
  descargando = signal<boolean>(false);
  huboCambioPases = false;

  async ngOnInit(): Promise<void> {
    this.invitado = this.config.data?.invitado;
    this.evento = this.config.data?.evento;

    if (!this.invitado || !this.evento) {
      this.ref.close();
      return;
    }

    this.pases.set(this.invitado.pasesConfirmados || 1);

    const payloadQr = JSON.stringify({
      evId: this.evento.id,
      invId: this.invitado.id,
      slug: this.evento.enlace,
    });

    try {
      const url = await QRCode.toDataURL(payloadQr, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });
      this.qrDataUrl.set(url);
    } catch (err) {
      console.error('Error generando QR de invitado:', err);
    } finally {
      this.cargandoQr.set(false);
    }
  }

  async cambiarPases(delta: number): Promise<void> {
    const actual = this.pases();
    const nuevo = Math.max(1, actual + delta);
    if (nuevo === actual || this.guardandoPases() || !this.evento?.id || !this.invitado?.id) return;

    this.pases.set(nuevo);
    this.huboCambioPases = true;
    this.guardandoPases.set(true);

    try {
      await this.eventService.actualizarPasesInvitado(this.evento.id, this.invitado.id, nuevo);
      this.invitado.pasesConfirmados = nuevo;
    } catch (err) {
      console.error('Error actualizando pases en modal QR:', err);
      this.pases.set(actual);
    } finally {
      this.guardandoPases.set(false);
    }
  }

  async descargarPase(): Promise<void> {
    if (!this.cardPaseRef?.nativeElement || this.descargando()) return;
    this.descargando.set(true);
    try {
      await capturarYDescargarTarjetaPaseWeb(this.cardPaseRef.nativeElement, this.invitado.nombre);
    } catch (err) {
      console.error('Error descargando tarjeta de pase:', err);
    } finally {
      this.descargando.set(false);
    }
  }

  compartirWhatsApp(): void {
    const ev = this.evento;
    const inv = this.invitado;
    if (!ev || !inv) return;

    const nombre = inv.nombre || 'Invitado(a)';
    const numPases = this.pases();
    const pasesTexto = numPases === 1 ? '1 persona' : `${numPases} personas`;
    const telefono = (inv.telefono || '').replace(/\D/g, '');
    const urlPase = `${window.location.origin}/e/${ev.enlace}?pase=${inv.id}`;
    const nombreEventoCompleto = ev.preTitulo ? `${ev.preTitulo} · ${ev.titulo}` : ev.titulo;

    const esPendiente = inv.estado === 'pendiente';
    const mensaje = esPendiente
      ? `¡Hola ${nombre}! 🎉\n\nTe invitamos con mucho cariño a *${nombreEventoCompleto}*.\n🎟️ Tienes asignados: *${pasesTexto}*.\n\n📲 Confirma tu asistencia y accede a tu pase aquí:\n${urlPase}\n\n¡Esperamos de corazón contar con tu presencia! ✨`
      : `¡Hola ${nombre}! 🎉\n\nAquí tienes tu Pase Digital VIP para *${nombreEventoCompleto}*.\n🎟️ Acceso autorizado para: *${pasesTexto}*.\n\n📲 Abre tu Pase con Código QR aquí:\n${urlPase}\n\nPresenta tu código en la recepción al llegar.\n¡Nos dará muchísimo gusto celebrar contigo! ✨`;

    const urlWa = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    window.open(urlWa, '_blank');
  }

  cerrar(): void {
    this.ref.close({
      pasesActualizados: this.huboCambioPases,
      nuevoTotal: this.pases(),
      invitadoId: this.invitado.id,
    });
  }
}
