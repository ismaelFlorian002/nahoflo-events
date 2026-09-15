import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { ReproductorMusicaComponent } from './reproductor-musica/reproductor-musica.component';
import { AudioService } from '../../core/services/audio.service';
import { Button } from 'primeng/button';
import QRCode from 'qrcode';
import { capturarYDescargarTarjetaPaseWeb } from '../../core/utils/image-compresor';

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    PaginatorModule,
    ReproductorMusicaComponent,
    Button,
  ],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.scss',
})
export class InvitationComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private fb = inject(FormBuilder); // Inyección para el formulario
  private countdownInterval: any;
  protected readonly audioService = inject(AudioService);
  // Estados del evento
  evento = signal<Evento | null>(null);
  isLoading = signal<boolean>(true);
  notFound = signal<boolean>(false);

  // Control de la portada de bienvenida
  invitacionAbierta = signal<boolean>(false);
  animandoSalida = signal<boolean>(false);

  abrirInvitacion(): void {
    // 1. Desbloquea la música de inmediato con el clic humano
    this.audioService.reproducir();

    // 2. Inicia la transición cinematográfica de salida (fade-out)
    this.animandoSalida.set(true);

    // 3. Remueve la pantalla suavemente después de 600ms
    setTimeout(() => {
      this.invitacionAbierta.set(true);
    }, 600);
  }

  // Estados de la cuenta regresiva
  dias = signal<number>(0);
  horas = signal<number>(0);
  minutos = signal<number>(0);
  segundos = signal<number>(0);
  eventoFinalizado = signal<boolean>(false);
  // Estados para el formulario RSVP
  enviandoRsvp = signal<boolean>(false);
  rsvpEnviado = signal<boolean>(false);
  // Formulario reactivo
  formRsvp = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    asistira: [true, Validators.required],
    pasesConfirmados: [1],
    telefono: [''],
    mensaje: [''],
  });
  // Pase VIP generado en tiempo real
  paseGenerado = signal<{
    id: string;
    nombre: string;
    pases: number;
    qrDataUrl: string;
  } | null>(null);

  // Cuando se abre con ?pase=ID, muestra únicamente el pase sin el resto de la invitación
  modoSoloPase = signal<boolean>(false);
  invitadoIdUrl = signal<string | null>(null);

  // Envío a la subcolección de Firestore (el anfitrión asigna los pases oficiales desde su portal)
  async enviarRsvp() {
    const ev = this.evento();
    if (!ev?.id || this.formRsvp.invalid || this.enviandoRsvp()) return;
    this.enviandoRsvp.set(true);
    try {
      const formVal = this.formRsvp.value;
      const asistira = Boolean(formVal.asistira);
      const pases = asistira ? Math.max(1, Number(formVal.pasesConfirmados) || 1) : 0;
      const res = await this.eventService.confirmarAsistencia(
        ev.id,
        {
          nombre: formVal.nombre!.trim(),
          asistira,
          estado: asistira ? 'confirmado' : 'declinado',
          pasesConfirmados: pases,
          telefono: formVal.telefono?.trim() || '',
          mensaje: formVal.mensaje?.trim() || '',
        },
        this.invitadoIdUrl() || undefined
      );

      if (ev.modulos?.tipoControlInvitados === 'total' && asistira && res?.id) {
        try {
          const payloadQr = JSON.stringify({
            evId: ev.id,
            invId: res.id,
            slug: ev.enlace,
          });

          const qrUrl = await QRCode.toDataURL(payloadQr, {
            width: 320,
            margin: 2,
            color: {
              dark: '#1e293b',
              light: '#ffffff',
            },
          });

          this.paseGenerado.set({
            id: res.id,
            nombre: formVal.nombre!.trim(),
            pases,
            qrDataUrl: qrUrl,
          });
        } catch (errQr) {
          console.error('Error generando QR tras confirmación:', errQr);
        }
      }

      this.rsvpEnviado.set(true);
    } catch (error) {
      console.error('Error al confirmar asistencia:', error);
    } finally {
      this.enviandoRsvp.set(false);
    }
  }

  // Permite al invitado guardar la imagen exacta de su Pase VIP (tal cual se ve en la web) en su celular
  async descargarPase(): Promise<void> {
    const pase = this.paseGenerado();
    if (!pase) return;

    const cardEl = document.querySelector('.vip-pass-card') as HTMLElement;

    if (cardEl) {
      await capturarYDescargarTarjetaPaseWeb(cardEl, pase.nombre);
    }
  }


  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    const paseId = this.route.snapshot.queryParamMap.get('pase');

    if (!slug) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    try {
      const data = await this.eventService.getEventBySlug(slug);
      if (data) {
        // Si la invitación web está deshabilitada en los módulos y no es un acceso directo con pase (?pase=ID)
        if (data.modulos && data.modulos.tieneInvitacion === false && !paseId) {
          this.notFound.set(true);
          this.isLoading.set(false);
          return;
        }

        this.evento.set(data);
        this.iniciarCuentaRegresiva(data.fecha);

        // Si el invitado abrió su enlace personal de Pase VIP (?pase=ID)
        if (paseId && data.id) {
          this.invitadoIdUrl.set(paseId);
          try {
            const listaInvitados = await this.eventService.getInvitados(data.id);
            const invitado = listaInvitados.find((i) => i.id === paseId);

            if (invitado) {
              if (invitado.asistira && invitado.estado !== 'pendiente') {
                const payloadQr = JSON.stringify({
                  evId: data.id,
                  invId: invitado.id,
                  slug: data.enlace,
                });

                const qrUrl = await QRCode.toDataURL(payloadQr, {
                  width: 320,
                  margin: 2,
                  color: {
                    dark: '#1e293b',
                    light: '#ffffff',
                  },
                });

                this.paseGenerado.set({
                  id: invitado.id!,
                  nombre: invitado.nombre,
                  pases: invitado.pasesConfirmados || 1,
                  qrDataUrl: qrUrl,
                });

                this.rsvpEnviado.set(true);
                this.modoSoloPase.set(true);
                this.invitacionAbierta.set(true);
              } else {
                // Si aún está pendiente o por confirmar, pre-llenamos sus datos
                this.formRsvp.patchValue({
                  nombre: invitado.nombre,
                  telefono: invitado.telefono || '',
                  pasesConfirmados: invitado.pasesConfirmados || 1,
                });
              }
            }
          } catch (errPase) {
            console.error('Error al cargar pase individual:', errPase);
          }
        }
      } else {
        this.notFound.set(true);
      }
    } catch (error) {
      console.error('Error al cargar la invitación:', error);
      this.notFound.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  // Convierte el Timestamp de Firestore a Date nativo y calcula la diferencia cada segundo
  private iniciarCuentaRegresiva(fechaFirestore: any) {
    let targetDate: Date;

    if (fechaFirestore?.toDate) {
      targetDate = fechaFirestore.toDate();
    } else if (fechaFirestore?.seconds) {
      targetDate = new Date(fechaFirestore.seconds * 1000);
    } else {
      targetDate = new Date(fechaFirestore);
    }

    const actualizar = () => {
      const ahora = new Date().getTime();
      const diferencia = targetDate.getTime() - ahora;

      if (diferencia <= 0) {
        this.eventoFinalizado.set(true);
        clearInterval(this.countdownInterval);
        return;
      }

      this.dias.set(Math.floor(diferencia / (1000 * 60 * 60 * 24)));
      this.horas.set(Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      this.minutos.set(Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60)));
      this.segundos.set(Math.floor((diferencia % (1000 * 60)) / 1000));
    };

    actualizar();
    this.countdownInterval = setInterval(actualizar, 1000);
  }
}


