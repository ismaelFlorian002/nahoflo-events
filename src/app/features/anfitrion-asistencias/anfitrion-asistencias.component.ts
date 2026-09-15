import {
  Component,
  OnDestroy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { InvitadoModel } from '../../core/models/invitado.model';
import { RecuerdoModel } from '../../core/models/RecuerdoModel';
import { copiarAlPortapapeles } from '../../core/utils/clipboard.util';

// Servicios de Clean Architecture (Fase 1)
import { ZipDownloaderService } from './services/zip-downloader.service';
import { QrScannerService } from './services/qr-scanner.service';

// Componentes Visuales Extraídos (Fase 2)
import { PinLoginComponent } from './components/pin-login/pin-login.component';
import { GuestTableComponent } from './components/guest-table/guest-table.component';
import { ScannerViewComponent } from './components/scanner-view/scanner-view.component';

// Modales existentes
import { QrMesaModalComponent } from '../album-digital/qr-mesa-modal/qr-mesa-modal.component';
import { InvitadoDetalleModalComponent } from './components/invitado-detalle-modal/invitado-detalle-modal.component';
import { InvitadoFormModalComponent } from './components/invitado-form-modal/invitado-form-modal.component';
import { ComoCompartirModalComponent } from './components/como-compartir-modal/como-compartir-modal.component';
import { InvitadoQrModalComponent } from './components/invitado-qr-modal/invitado-qr-modal.component';

@Component({
  selector: 'app-anfitrion-asistencias',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    ProgressSpinnerModule,
    DynamicDialogModule,
    PinLoginComponent,
    GuestTableComponent,
    ScannerViewComponent,
  ],
  providers: [DialogService],
  templateUrl: './anfitrion-asistencias.component.html',
  styleUrl: './anfitrion-asistencias.component.scss',
})
export class AnfitrionAsistenciasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);

  // Servicios inyectados para lógica pesada
  private zipDownloaderService = inject(ZipDownloaderService);
  private qrScannerService = inject(QrScannerService);

  // Estado general
  evento = signal<Evento | null>(null);
  invitados = signal<InvitadoModel[]>([]);
  cargando = signal<boolean>(true);
  notFound = signal<boolean>(false);

  // Control de descargas (delegado reactivamente a ZipDownloaderService)
  descargandoTodo = this.zipDownloaderService.descargandoTodo;
  progresoDescarga = this.zipDownloaderService.progresoDescarga;

  // Control de PIN
  pinDesbloqueado = signal<boolean>(false);

  // Pestañas del portal anfitrión
  pestanaActiva = signal<'resumen' | 'invitados' | 'recepcion' | 'album'>('resumen');

  // Control de copiado de enlaces
  copiadoGeneral = signal<boolean>(false);

  // Recuerdos del álbum colaborativo
  recuerdos = signal<RecuerdoModel[]>([]);
  eliminandoId = signal<string | null>(null);

  // Métricas globales
  totalPases = signal<number>(0);
  totalConfirmados = signal<number>(0);
  totalPendientesConfirmacion = signal<number>(0);
  totalCancelados = signal<number>(0);

  // Métricas de Aforo y Recepción en Vivo (compartidas con la pestaña Resumen)
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

  // Métricas de confirmación para la pestaña de Resumen
  totalPasesReservados = computed(() =>
    this.invitados().reduce((acc, i) => acc + (Number(i.pasesConfirmados) || 1), 0),
  );
  porcentajeConfirmacion = computed(() => {
    const total = this.invitados().length;
    if (total === 0) return 0;
    return Math.round((this.totalConfirmados() / total) * 100);
  });

  // Helpers reactivos para los paquetes y módulos contratados
  tieneInvitacion = computed(() => this.evento()?.modulos?.tieneInvitacion ?? true);

  tieneControlInvitados = computed(() => {
    const mod = this.evento()?.modulos;
    return !mod || mod.tipoControlInvitados !== 'inactivo';
  });

  tieneRecepcionOPuerta = computed(() => {
    const mod = this.evento()?.modulos;
    return mod?.tipoControlInvitados === 'total' || mod?.tipoControlInvitados === 'lista_puerta';
  });

  tieneAlbum = computed(() => {
    const mod = this.evento()?.modulos;
    return !mod || mod.tieneAlbum;
  });

  tieneModulosAsistencias = computed(() => {
    return this.tieneControlInvitados() || this.tieneAlbum();
  });

  esSoloInvitacion = computed(() => {
    return this.tieneInvitacion() && !this.tieneModulosAsistencias();
  });

  sinServiciosActivos = computed(() => {
    return !this.tieneInvitacion() && !this.tieneModulosAsistencias();
  });

  totalPestanasDisponibles = computed(() => {
    let count = 1;
    if (this.tieneControlInvitados()) count++;
    if (this.tieneRecepcionOPuerta()) count++;
    if (this.tieneAlbum()) count++;
    return count;
  });

  urlInvitacionCompleta = computed(() => {
    const ev = this.evento();
    if (!ev?.enlace) return '';
    return `${window.location.origin}/e/${ev.enlace}`;
  });

  async ngOnInit(): Promise<void> {
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

        if (ev.modulos?.tipoControlInvitados === 'inactivo' && ev.modulos?.tieneAlbum) {
          this.pestanaActiva.set('album');
        }

        const pinSesion = sessionStorage.getItem(`pin_${ev.id}`);
        if (pinSesion && pinSesion === ev.pinAnfitrion && ev.id) {
          const tareas: Promise<any>[] = [];
          this.pinDesbloqueado.set(true);
          if (!ev.modulos || ev.modulos.tipoControlInvitados !== 'inactivo') {
            tareas.push(this.cargarInvitados(ev.id));
          }
          if (!ev.modulos || ev.modulos.tieneAlbum) {
            tareas.push(this.cargarRecuerdos(ev.id));
          }
          await Promise.all(tareas);
        }
      } else {
        this.notFound.set(true);
      }
    } catch (e) {
      console.error('Error al cargar evento de anfitrión:', e);
      this.notFound.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  // Manejador del evento emitido por <app-pin-login>
  async onPinValido(pin: string): Promise<void> {
    const ev = this.evento();
    if (!ev || !ev.id) return;

    this.pinDesbloqueado.set(true);
    sessionStorage.setItem(`pin_${ev.id}`, pin);

    const tareas: Promise<any>[] = [];
    if (!ev.modulos || ev.modulos.tipoControlInvitados !== 'inactivo') {
      tareas.push(this.cargarInvitados(ev.id));
    }
    if (!ev.modulos || ev.modulos.tieneAlbum) {
      tareas.push(this.cargarRecuerdos(ev.id));
    }
    await Promise.all(tareas);
  }

  salir(): void {
    const ev = this.evento();
    if (ev?.id) {
      sessionStorage.removeItem(`pin_${ev.id}`);
    }
    this.qrScannerService.detenerEscaner();
    this.pinDesbloqueado.set(false);
  }

  async cargarInvitados(eventoId: string): Promise<void> {
    this.cargando.set(true);
    try {
      const lista = await this.eventService.getInvitados(eventoId);
      const normalizada = lista.map((i) => ({
        ...i,
        fechaConfirmacion: i.fechaConfirmacion?.toDate
          ? i.fechaConfirmacion.toDate()
          : i.fechaConfirmacion
            ? new Date(i.fechaConfirmacion)
            : null,
      }));
      this.invitados.set(normalizada);

      const pases = normalizada
        .filter((i) => (i.estado ? i.estado === 'confirmado' : i.asistira))
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      const confirmados = normalizada.filter((i) =>
        i.estado ? i.estado === 'confirmado' : i.asistira,
      ).length;
      const pendientes = normalizada.filter((i) => i.estado === 'pendiente').length;
      const cancelados = normalizada.filter((i) =>
        i.estado ? i.estado === 'declinado' : !i.asistira,
      ).length;

      this.totalPases.set(pases);
      this.totalConfirmados.set(confirmados);
      this.totalPendientesConfirmacion.set(pendientes);
      this.totalCancelados.set(cancelados);
    } catch (error) {
      console.error('Error cargando invitados:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarRecuerdos(eventoId: string): Promise<void> {
    try {
      const lista = await this.eventService.getRecuerdos(eventoId);
      this.recuerdos.set(lista);
    } catch (error) {
      console.error('Error al cargar recuerdos del álbum:', error);
    }
  }

  async eliminarRecuerdo(recuerdo: RecuerdoModel): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !recuerdo.id) return;

    const seguro = confirm(
      `¿Estás seguro de eliminar el recuerdo de "${recuerdo.nombreAutor}"? Se retirará del álbum inmediatamente.`,
    );
    if (!seguro) return;

    this.eliminandoId.set(recuerdo.id);
    try {
      await this.eventService.eliminarRecuerdo(ev.id, recuerdo.id);
      this.recuerdos.update((lista) => lista.filter((r) => r.id !== recuerdo.id));
    } catch (error) {
      console.error('Error al eliminar recuerdo:', error);
      alert('Ocurrió un error al eliminar la foto. Intenta de nuevo.');
    } finally {
      this.eliminandoId.set(null);
    }
  }

  contarFotosTotales(): number {
    return this.recuerdos().reduce((total, r) => {
      const cant = r.fotosUrls && r.fotosUrls.length > 0 ? r.fotosUrls.length : r.fotoUrl ? 1 : 0;
      return total + cant;
    }, 0);
  }

  // Delegado a ZipDownloaderService
  async descargarRecuerdo(recuerdo: RecuerdoModel, event: Event): Promise<void> {
    await this.zipDownloaderService.descargarRecuerdo(recuerdo, event);
  }

  // Delegado a ZipDownloaderService
  async descargarTodasLasFotos(): Promise<void> {
    await this.zipDownloaderService.descargarTodasLasFotos(this.recuerdos(), this.evento());
  }

  abrirModalQrMesas(): void {
    const ev = this.evento();
    if (!ev) return;

    this.dialogService.open(QrMesaModalComponent, {
      header: 'Tarjeta QR para Centros de Mesa',
      width: '560px',
      breakpoints: { '640px': '95vw' },
      dismissableMask: true,
      focusOnShow: false,
      data: { evento: ev },
    });
  }

  abrirModalDetalle(invitado: InvitadoModel): void {
    const ref = this.dialogService.open(InvitadoDetalleModalComponent, {
      header: 'Detalle del Invitado',
      width: '680px',
      breakpoints: { '960px': '75vw', '640px': '92vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        evento: this.evento(),
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.accion === 'editar' && resultado.invitado) {
        this.abrirModalEditar(resultado.invitado);
      }
    });
  }

  abrirModalEditar(invitado: InvitadoModel): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const ref = this.dialogService.open(InvitadoFormModalComponent, {
      header: 'Editar Invitado',
      width: '680px',
      breakpoints: { '960px': '80vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        eventoId: ev.id,
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.guardado) {
        this.cargarInvitados(ev.id!);
      }
    });
  }

  abrirModalCrearInvitado(): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const ref = this.dialogService.open(InvitadoFormModalComponent, {
      header: 'Registrar Nuevo Invitado',
      width: '680px',
      breakpoints: { '960px': '80vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: {
        eventoId: ev.id,
        invitadosExistentes: this.invitados(),
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.guardado) {
        this.cargarInvitados(ev.id!);
      }
    });
  }

  abrirModalCompartir(): void {
    const ev = this.evento();
    if (!ev) return;

    this.dialogService.open(ComoCompartirModalComponent, {
      header: '¿Cómo compartir tus invitaciones?',
      width: '620px',
      breakpoints: { '960px': '85vw', '640px': '95vw' },
      closable: true,
      dismissableMask: true,
      data: {
        evento: ev,
      },
    });
  }

  abrirModalQr(invitado: InvitadoModel): void {
    const ev = this.evento();
    if (!ev) return;

    const ref = this.dialogService.open(InvitadoQrModalComponent, {
      header: 'Pase Digital VIP',
      width: '420px',
      breakpoints: { '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        evento: ev,
      },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.pasesActualizados && res.invitadoId) {
        this.invitados.update((lista) =>
          lista.map((i) =>
            i.id === res.invitadoId ? { ...i, pasesConfirmados: res.nuevoTotal } : i,
          ),
        );
        const pasesTotales = this.invitados()
          .filter((i) => i.asistira)
          .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
        this.totalPases.set(pasesTotales);
      }
    });
  }

  async cambiarPasesInvitado(invitado: InvitadoModel, delta: number): Promise<void> {
    const evId = this.evento()?.id;
    const invId = invitado.id;
    if (!invId || !evId) return;

    const actual = invitado.pasesConfirmados || 1;
    const nuevo = Math.max(1, actual + delta);
    if (nuevo === actual) return;

    this.invitados.update((lista) =>
      lista.map((i) => (i.id === invId ? { ...i, pasesConfirmados: nuevo } : i)),
    );

    const pasesTotales = this.invitados()
      .filter((i) => i.asistira)
      .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
    this.totalPases.set(pasesTotales);

    try {
      await this.eventService.actualizarPasesInvitado(evId, invId, nuevo);
    } catch (err) {
      console.error('Error al actualizar pases del invitado:', err);
      this.invitados.update((lista) =>
        lista.map((i) => (i.id === invId ? { ...i, pasesConfirmados: actual } : i)),
      );
      const pasesTotalesRev = this.invitados()
        .filter((i) => i.asistira)
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      this.totalPases.set(pasesTotalesRev);
    }
  }

  // Manejador del check-in emitido por <app-scanner-view>
  async onCheckIn(invitado: InvitadoModel, pases?: number): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !invitado.id) return;

    const pasesEfectivos = pases ?? (invitado.pasesConfirmados || 1);
    await this.eventService.registrarCheckIn(ev.id, invitado.id, pasesEfectivos);

    const ahora = new Date();
    this.invitados.update((lista) =>
      lista.map((i) =>
        i.id === invitado.id
          ? { ...i, haIngresado: true, horaIngreso: ahora, pasesIngresados: pasesEfectivos }
          : i,
      ),
    );
  }

  // Manejador de reversión de check-in emitido por <app-scanner-view>
  async revertirCheckIn(invitado: InvitadoModel): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !invitado.id) return;

    await this.eventService.revertirCheckIn(ev.id, invitado.id);

    this.invitados.update((lista) =>
      lista.map((i) =>
        i.id === invitado.id
          ? { ...i, haIngresado: false, horaIngreso: null, pasesIngresados: 0 }
          : i,
      ),
    );
  }

  cambiarPestana(pestana: 'resumen' | 'invitados' | 'recepcion' | 'album'): void {
    this.pestanaActiva.set(pestana);
    this.qrScannerService.detenerEscaner();
  }

  async copiarEnlaceGeneral(): Promise<void> {
    const ev = this.evento();
    if (!ev?.enlace) return;
    const url = `${window.location.origin}/e/${ev.enlace}`;
    await copiarAlPortapapeles(url);
    this.copiadoGeneral.set(true);
    setTimeout(() => this.copiadoGeneral.set(false), 2500);
  }

  abrirInvitacion(): void {
    const ev = this.evento();
    if (!ev?.enlace) return;
    window.open(`/e/${ev.enlace}`, '_blank');
  }

  abrirAlbumEnVivo(): void {
    const ev = this.evento();
    if (!ev?.enlace) return;
    window.open(`/e/${ev.enlace}/album`, '_blank');
  }

  enviarPaseVipWhatsApp(invitado: InvitadoModel): void {
    const ev = this.evento();
    if (!ev?.enlace || !invitado) return;

    const nombre = invitado.nombre || 'Invitado(a)';
    const pases = invitado.pasesConfirmados || 1;
    const pasesTexto = pases === 1 ? '1 pase personal' : `${pases} pases`;
    const urlPase = `${window.location.origin}/e/${ev.enlace}?pase=${invitado.id}`;
    const nombreEvento = ev.preTitulo ? `${ev.preTitulo} · ${ev.titulo}` : ev.titulo;

    let mensaje = '';
    if (ev.modulos?.tipoControlInvitados === 'total') {
      mensaje = `¡Hola ${nombre}! ✨\n\nAquí tienes tu *Pase Digital de Acceso VIP* para *${nombreEvento}*.\n\n🎟️ *Acceso autorizado:* ${pasesTexto}\n\n📲 Muestra tu código QR al ingresar al evento desde este enlace:\n${urlPase}\n\nPresenta este código en la recepción al llegar. ¡Esperamos verte y celebrar juntos! 🎉`;
    } else {
      mensaje = `¡Hola ${nombre}! ✨\n\nAquí tienes tu *Pase Digital de Acceso* para *${nombreEvento}*.\n\n🎟️ *Acceso asignado:* ${pasesTexto}\n\n📲 Accede a tu pase digital aquí:\n${urlPase}\n\n¡Esperamos contar con tu presencia! 🎉`;
    }

    const telefono = (invitado.telefono || '').replace(/\D/g, '');
    const urlWa =
      telefono && telefono.length >= 10
        ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    window.open(urlWa, '_blank');
  }

  enviarInvitacionWhatsApp(invitado: InvitadoModel): void {
    const ev = this.evento();
    if (!ev?.enlace || !invitado) return;

    const nombre = invitado.nombre || 'Invitado(a)';
    const pases = invitado.pasesConfirmados || 1;
    const pasesTexto = pases === 1 ? '1 pase reservado' : `${pases} pases reservados`;
    const urlPase = `${window.location.origin}/e/${ev.enlace}?pase=${invitado.id}`;
    const nombreEvento = ev.preTitulo ? `${ev.preTitulo} · ${ev.titulo}` : ev.titulo;

    let mensaje = '';
    if (invitado.estado === 'pendiente') {
      mensaje = `¡Hola ${nombre}! 🎉\n\nTe invitamos con mucho cariño a *${nombreEvento}*.\n🎟️ Tienes asignados: *${pasesTexto}*.\n\n📲 Confirma tu asistencia y accede a tu invitación aquí:\n${urlPase}\n\n¡Esperamos de corazón contar con tu presencia! ✨`;
    } else if (invitado.estado === 'confirmado' || invitado.asistira) {
      mensaje = `¡Hola ${nombre}! 🎉\n\nTe recordamos tu pase para *${nombreEvento}*.\n🎟️ Acceso autorizado para: *${pasesTexto}*.\n\n📲 Abre tu pase digital y ubicación aquí:\n${urlPase}\n\n¡Nos vemos muy pronto! ✨`;
    } else {
      mensaje = `¡Hola ${nombre}! 🎉\n\nTe compartimos los detalles de *${nombreEvento}* por si surge algún cambio en tus planes:\n${urlPase}\n\n¡Un fuerte abrazo! ✨`;
    }

    const telefono = (invitado.telefono || '').replace(/\D/g, '');
    const urlWa =
      telefono && telefono.length >= 10
        ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    window.open(urlWa, '_blank');
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

  formatearFechaEvento(fecha: any): string {
    if (!fecha) return '-';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  ngOnDestroy(): void {
    this.qrScannerService.detenerEscaner();
  }
}
