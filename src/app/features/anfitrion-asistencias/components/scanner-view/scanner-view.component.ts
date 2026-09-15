import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Evento } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { QrScannerService } from '../../services/qr-scanner.service';
import { AudioFeedbackService } from '../../services/audio-feedback.service';

@Component({
  selector: 'app-scanner-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TooltipModule],
  templateUrl: './scanner-view.component.html',
  styleUrl: '../../anfitrion-asistencias.component.scss',
})
export class ScannerViewComponent implements OnDestroy {
  private qrScannerService = inject(QrScannerService);
  private audioFeedbackService = inject(AudioFeedbackService);

  // Inputs
  evento = input<Evento | null>(null);
  invitados = input<InvitadoModel[]>([]);
  totalPases = input<number>(0);

  // Outputs hacia el padre para registrar o revertir en Firestore y estado global
  checkIn = output<{ invitado: InvitadoModel; pases?: number }>();
  revertir = output<InvitadoModel>();

  // Estado del Escáner y Check-in
  escanerActivo = this.qrScannerService.escanerActivo;
  procesandoCheckIn = signal<boolean>(false);
  resultadoEscaneo = signal<{
    tipo: 'exito' | 'duplicado' | 'invalido';
    mensaje: string;
    invitado?: InvitadoModel;
    hora?: string;
  } | null>(null);

  // Búsqueda manual de respaldo en recepción
  busquedaRecepcion = signal<string>('');

  // Métricas de Aforo y Recepción en Vivo
  totalIngresados = computed(() =>
    this.invitados()
      .filter((i) => i.haIngresado)
      .reduce((acc, i) => acc + (i.pasesIngresados ?? i.pasesConfirmados ?? 1), 0),
  );

  totalPendientes = computed(() => Math.max(0, this.totalPases() - this.totalIngresados()));

  porcentajeAsistencia = computed(() => {
    const tot = this.totalPases();
    return tot > 0 ? Math.min(100, Math.round((this.totalIngresados() / tot) * 100)) : 0;
  });

  invitadosRecepcionFiltrados = computed(() => {
    const lista = this.invitados().filter((i) =>
      i.estado ? i.estado === 'confirmado' : i.asistira,
    );
    const q = this.busquedaRecepcion().trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (i) =>
        (i.nombre || '').toLowerCase().includes(q) || (i.telefono || '').toLowerCase().includes(q),
    );
  });

  async toggleEscaner(): Promise<void> {
    await this.qrScannerService.toggleEscaner('qr-reader', (decodedText) =>
      this.procesarCodigoEscaneado(decodedText),
    );
  }

  async iniciarEscaner(): Promise<void> {
    this.resultadoEscaneo.set(null);
    // Un leve retardo asegura que el div #qr-reader esté renderizado en el DOM
    setTimeout(async () => {
      await this.qrScannerService.iniciarEscaner('qr-reader', (decodedText) =>
        this.procesarCodigoEscaneado(decodedText),
      );
    }, 150);
  }

  async detenerEscaner(): Promise<void> {
    await this.qrScannerService.detenerEscaner();
  }

  async procesarCodigoEscaneado(decodedText: string): Promise<void> {
    if (this.procesandoCheckIn()) return;
    this.procesandoCheckIn.set(true);

    try {
      let data: { evId: string; invId: string; slug: string };
      try {
        data = JSON.parse(decodedText);
      } catch {
        this.audioFeedbackService.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'El código escaneado no es un pase válido de NahoFlo Events.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      const ev = this.evento();
      if (!ev || data.evId !== ev.id) {
        this.audioFeedbackService.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'Este pase pertenece a otro evento.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      const invitado = this.invitados().find((i) => i.id === data.invId);
      if (!invitado) {
        this.audioFeedbackService.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'Invitado no encontrado en la lista oficial.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      if (invitado.haIngresado) {
        this.audioFeedbackService.reproducirSonido('alerta');
        const horaStr = this.formatearFecha(invitado.horaIngreso);
        this.resultadoEscaneo.set({
          tipo: 'duplicado',
          mensaje: `¡Pase ya utilizado previamente a las ${horaStr}!`,
          invitado,
          hora: horaStr,
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2500);
        return;
      }

      this.hacerCheckIn(invitado);
    } finally {
      setTimeout(() => this.procesandoCheckIn.set(false), 1500);
    }
  }

  hacerCheckIn(invitado: InvitadoModel, pases?: number): void {
    const pasesEfectivos = pases ?? (invitado.pasesConfirmados || 1);
    const ahora = new Date();

    this.checkIn.emit({ invitado, pases: pasesEfectivos });
    this.audioFeedbackService.reproducirSonido('exito');

    this.resultadoEscaneo.set({
      tipo: 'exito',
      mensaje: `¡Acceso Autorizado! Bienvenido(a) ${invitado.nombre}.`,
      invitado: { ...invitado, haIngresado: true, pasesIngresados: pasesEfectivos },
      hora: ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  revertirCheckIn(invitado: InvitadoModel): void {
    this.revertir.emit(invitado);
    if (this.resultadoEscaneo()?.invitado?.id === invitado.id) {
      this.resultadoEscaneo.set(null);
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

  ngOnDestroy(): void {
    this.detenerEscaner();
  }
}
