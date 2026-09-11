import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EventService } from '../../core/services/eventService';
import { Evento } from '../../core/models/event.model';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    PaginatorModule,
  ],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.scss',
})
export class InvitationComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private fb = inject(FormBuilder); // Inyección para el formulario
  private countdownInterval: any;

  // Estados del evento
  evento = signal<Evento | null>(null);
  isLoading = signal<boolean>(true);
  notFound = signal<boolean>(false);

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
    pasesConfirmados: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    telefono: [''],
    mensaje: [''],
  });

  // Envío a la subcolección de Firestore
  async enviarRsvp() {
    const ev = this.evento();
    if (!ev?.id || this.formRsvp.invalid || this.enviandoRsvp()) return;
    this.enviandoRsvp.set(true);
    try {
      await this.eventService.confirmarAsistencia(ev.id, this.formRsvp.value as any);
      this.rsvpEnviado.set(true);
    } catch (error) {
      console.error('Error al confirmar asistencia:', error);
    } finally {
      this.enviandoRsvp.set(false);
    }
  }

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    try {
      const data = await this.eventService.getEventBySlug(slug);
      if (data) {
        this.evento.set(data);
        this.iniciarCuentaRegresiva(data.fecha);
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

  incrementarPases() {
    const actual = this.formRsvp.get('pasesConfirmados')?.value || 1;
    if (actual < 20) {
      this.formRsvp.patchValue({ pasesConfirmados: actual + 1 });
    }
  }

  decrementarPases() {
    const actual = this.formRsvp.get('pasesConfirmados')?.value || 1;
    if (actual > 1) {
      this.formRsvp.patchValue({ pasesConfirmados: actual - 1 });
    }
  }
}
