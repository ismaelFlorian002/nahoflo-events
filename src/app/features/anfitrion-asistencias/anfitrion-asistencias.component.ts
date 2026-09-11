import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EventService } from '../../core/services/eventService';
import { Evento } from '../../core/models/event.model';
import { InvitadoModel } from '../../core/models/invitado.model';

@Component({
  selector: 'app-anfitrion-asistencias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    TagModule,
    ButtonModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './anfitrion-asistencias.component.html',
  styleUrl: './anfitrion-asistencias.component.scss',
})
export class AnfitrionAsistenciasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);

  evento = signal<Evento | null>(null);
  invitados = signal<InvitadoModel[]>([]);
  cargando = signal<boolean>(true);
  notFound = signal<boolean>(false);

  // Control de PIN
  pinIngresado = '';
  pinDesbloqueado = signal<boolean>(false);
  errorPin = signal<boolean>(false);

  // Métricas
  totalPases = signal<number>(0);
  totalConfirmados = signal<number>(0);
  totalCancelados = signal<number>(0);

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.notFound.set(true);
      this.cargando.set(false);
      return;
    }

    try {
      const ev = await this.eventService.getEventBySlug(slug);
      if (ev) {
        this.evento.set(ev);
        // Si ya había ingresado el PIN en esta sesión, lo recordamos
        const pinSesion = sessionStorage.getItem(`pin_${ev.id}`);
        if (pinSesion && pinSesion === ev.pinAnfitrion) {
          this.pinDesbloqueado.set(true);
          await this.cargarInvitados(ev.id!);
        }
      } else {
        this.notFound.set(true);
      }
    } catch (error) {
      console.error('Error al cargar evento:', error);
      this.notFound.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  async verificarPin() {
    const ev = this.evento();
    if (!ev || !ev.id) return;

    if (this.pinIngresado.trim() === ev.pinAnfitrion) {
      this.errorPin.set(false);
      this.pinDesbloqueado.set(true);
      sessionStorage.setItem(`pin_${ev.id}`, this.pinIngresado.trim());
      await this.cargarInvitados(ev.id);
    } else {
      this.errorPin.set(true);
    }
  }

  async cargarInvitados(eventoId: string) {
    this.cargando.set(true);
    try {
      const lista = await this.eventService.getInvitados(eventoId);
      this.invitados.set(lista);

      // Calcular KPIs
      const pases = lista
        .filter((i) => i.asistira)
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      const confirmados = lista.filter((i) => i.asistira).length;
      const cancelados = lista.filter((i) => !i.asistira).length;

      this.totalPases.set(pases);
      this.totalConfirmados.set(confirmados);
      this.totalCancelados.set(cancelados);
    } catch (error) {
      console.error('Error cargando invitados:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '-';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
