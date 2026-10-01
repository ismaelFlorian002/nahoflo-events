import {
  Component,
  OnDestroy,
  computed,
  inject,
  OnInit,
  signal,
  forwardRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { PORTAL_CONTEXT } from './portal-context';
import { PORTAL_PATHS, PortalSection } from './portal-sections';
import { PortalEventAccess, initialPortalSection, puedeAdministrarSinPin } from './portal-access';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EventService } from '../../core/services/event.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { Evento } from '../../core/models/event.model';
import { InvitadoModel } from '../../core/models/invitado.model';
import { RecuerdoModel } from '../../core/models/RecuerdoModel';
import { copiarAlPortapapeles } from '../../core/utils/clipboard.util';

// Servicios de Clean Architecture (Fase 1 & Fase 5)
import { ZipDownloaderService } from './services/zip-downloader.service';
import { QrScannerService } from './services/qr-scanner.service';
import { PdfReportService } from './services/pdf-report.service';

// Componentes Visuales Extraídos (Fase 2, 3, 4 & 5)
import { PinLoginComponent } from './components/pin-login/pin-login.component';
import { AgenciaBrandingModalComponent } from './components/agencia-branding-modal/agencia-branding-modal.component';
import { PortalNavigationComponent, PortalNavigationItem } from './components/portal-navigation/portal-navigation.component';

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
    PortalNavigationComponent,
  ],
  providers: [DialogService, { provide: PORTAL_CONTEXT, useExisting: forwardRef(() => AnfitrionAsistenciasComponent) }],
  templateUrl: './anfitrion-asistencias.component.html',
  styleUrl: './anfitrion-asistencias.component.scss',
})


export class AnfitrionAsistenciasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private portalAccess = inject(PortalEventAccess);
  private destroyRef = inject(DestroyRef);

  readonly rutaPermitida = signal(false);

  private sincronizarRuta(): void {
    if (!this.evento()) return;
    const section = this.route.firstChild?.snapshot.data['section'] as PortalSection | undefined;
    const allowed = section && this.navegacionPortal().some(item => item.id === section);
    this.rutaPermitida.set(!!allowed);
    if (!allowed) {
      const ev = this.evento()!;
      const initial = initialPortalSection(ev);
      void this.router.navigate([PORTAL_PATHS[initial]], { relativeTo: this.route, replaceUrl: true });
      return;
    }
    if (this.pestanaActiva() !== section) this.qrScannerService.detenerEscaner();
    this.pestanaActiva.set(section);
  }
  private eventService = inject(EventService);
  private usuarioService = inject(UsuarioService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Servicios inyectados para lógica pesada
  private zipDownloaderService = inject(ZipDownloaderService);
  private qrScannerService = inject(QrScannerService);
  private pdfReportService = inject(PdfReportService);

  descargandoDossier = signal<boolean>(false);

  abrirModalBrandingAgencia(): void {
    const ev = this.evento();
    if (!ev) return;

    const ref = this.dialogService.open(AgenciaBrandingModalComponent, {
      header: 'Configuración de Marca Blanca / Agencia',
      width: '1200px',
      breakpoints: { '960px': '85vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: { evento: ev },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.guardado && res.datosAgencia) {
        this.evento.update((e) => (e ? { ...e, ...res.datosAgencia } : null));
        this.messageService.add({
          severity: 'success',
          summary: 'Marca Blanca Actualizada',
          detail: 'Se guardaron los datos de la agencia en el evento.',
        });
      }
    });
  }

  async descargarDossierPdf(): Promise<void> {
    const ev = this.evento();
    if (!ev) return;

    this.descargandoDossier.set(true);
    try {
      await this.pdfReportService.generarDossierCompletoEvento(ev, this.invitados());
      this.messageService.add({
        severity: 'success',
        summary: 'Dossier Generado',
        detail: 'El informe PDF completo del evento ha sido descargado.',
      });
    } catch (err) {
      console.error('Error al generar dossier PDF:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el dossier PDF del evento.',
      });
    } finally {
      this.descargandoDossier.set(false);
    }
  }


  // Estado general
  evento = signal<Evento | null>(null);
  invitados = signal<InvitadoModel[]>([]);
  cargando = signal<boolean>(true);
  notFound = signal<boolean>(false);

  // Control de descargas (delegado reactivamente a ZipDownloaderService)
  descargandoTodo = this.zipDownloaderService.descargandoTodo;
  progresoDescarga = this.zipDownloaderService.progresoDescarga;

  onEventoActualizado(ev: Evento): void {
    this.evento.set(ev);
    this.portalAccess.update(ev);
    this.sincronizarRuta();
  }

  // Control de PIN
  pinDesbloqueado = signal<boolean>(false);
  // Admin o partner dueño del evento: entra sin PIN y "Salir" regresa a su panel
  accesoStaff = signal<boolean>(false);
  private rutaPanelStaff = '/partner/eventos';

  // Pestañas del portal anfitrión
  pestanaActiva = signal<PortalSection>('resumen');



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

  promedioPasesPorRegistro = computed(() => {
    const total = this.invitados().length;
    if (total === 0) return '0';
    return (this.totalPases() / total).toFixed(1);
  });

  // Helpers reactivos para los paquetes y módulos contratados
  tieneInvitacion = computed(() => this.evento()?.modulos?.tieneInvitacion ?? true);

  tieneControlInvitados = computed(() => {
    const mod = this.evento()?.modulos;
    return !mod || mod.tipoControlInvitados !== 'inactivo';
  });

  tieneRecepcionOPuerta = computed(() => {
    const mod = this.evento()?.modulos;
    return (
      !mod ||
      mod.tipoControlInvitados === 'total' ||
      mod.tipoControlInvitados === 'lista_puerta' ||
      mod.tipoControlInvitados === 'basico'
    );
  });

  tieneAlbum = computed(() => {
    const mod = this.evento()?.modulos;
    return !mod || mod.tieneAlbum;
  });

  tienePlannerSuite = computed(() => {
    const mod = this.evento()?.modulos;
    return !mod || (mod.tienePlannerSuite ?? true);
  });

  // Métricas reactivas de Planner Suite (compartidas con la pestaña Resumen)
  minutarioItems = computed(() => this.evento()?.minutario || []);
  minutarioTotal = computed(() => this.minutarioItems().length);
  minutarioCompletados = computed(() => this.minutarioItems().filter((m) => m.completado).length);

  presupuestoItems = computed(() => this.evento()?.presupuesto || []);
  presupuestoTotalReal = computed(() =>
    this.presupuestoItems().reduce((acc, i) => acc + (Number(i.costoReal) || 0), 0),
  );
  presupuestoTotalPagado = computed(() =>
    this.presupuestoItems().reduce((acc, i) => acc + (Number(i.montoPagado) || 0), 0),
  );
  presupuestoSaldoPendiente = computed(() =>
    Math.max(0, this.presupuestoTotalReal() - this.presupuestoTotalPagado()),
  );
  presupuestoPorcentajePagado = computed(() => {
    const tot = this.presupuestoTotalReal();
    return tot > 0 ? Math.min(100, Math.round((this.presupuestoTotalPagado() / tot) * 100)) : 0;
  });

  proveedoresItems = computed(() => this.evento()?.proveedores || []);
  proveedoresTotal = computed(() => this.proveedoresItems().length);
  proveedoresCategoriasCount = computed(() => {
    const cats = new Set(this.proveedoresItems().map((p) => p.categoria).filter(Boolean));
    return cats.size;
  });

  checklistItems = computed(() => this.evento()?.checklist || []);
  checklistTotal = computed(() => this.checklistItems().length);
  checklistCompletadas = computed(() => this.checklistItems().filter((t) => t.completada).length);
  checklistPendientes = computed(() => Math.max(0, this.checklistTotal() - this.checklistCompletadas()));
  checklistPorcentajeAvance = computed(() => {
    const tot = this.checklistTotal();
    return tot > 0 ? Math.min(100, Math.round((this.checklistCompletadas() / tot) * 100)) : 0;
  });

  permiteMarcaBlanca = computed(() => {
    const mod = this.evento()?.modulos;
    return Boolean(mod?.permiteMarcaBlanca);
  });

  whatsappAgenciaUrl = computed(() => {
    const tel = this.evento()?.agenciaTelefono;
    if (!tel) return '';
    const cleanTel = tel.replace(/[^0-9]/g, '');
    return cleanTel ? `https://wa.me/${cleanTel}` : '';
  });

  readonly marcaPortal = computed(() => {
    const nombre = this.evento()?.agenciaNombre;
    return this.permiteMarcaBlanca() && nombre ? nombre : 'NahoFlo Creative Studio';
  });

  readonly ayudaWhatsappUrl = computed(() => {
    const titulo = this.evento()?.titulo || 'mi evento';
    const msg = `Hola, necesito ayuda con el portal de anfitrión de ${titulo}.`;
    const base = (this.permiteMarcaBlanca() && this.whatsappAgenciaUrl()) || 'https://wa.me/524461449505';
    return `${base}?text=${encodeURIComponent(msg)}`;
  });

  tieneModulosAsistencias = computed(() => {
    return this.tieneControlInvitados() || this.tieneAlbum() || this.tienePlannerSuite();
  });

  esSoloInvitacion = computed(() => {
    return this.tieneInvitacion() && !this.tieneModulosAsistencias();
  });

  sinServiciosActivos = computed(() => {
    return !this.tieneInvitacion() && !this.tieneModulosAsistencias() && !this.permiteMarcaBlanca();
  });

  totalPestanasDisponibles = computed(() => {
    let count = 1; // Resumen (siempre disponible)
    if (this.tieneControlInvitados()) count++;
    if (this.tieneRecepcionOPuerta()) count++;
    if (this.tieneAlbum()) count++;
    if (this.tienePlannerSuite()) count += 4; // Minutario, Presupuesto, Proveedores, Checklist
    return count;
  });

  readonly navegacionPortal = computed<PortalNavigationItem[]>(() => {
    const items: PortalNavigationItem[] = [
      { id: 'resumen', label: 'Resumen', icon: 'pi pi-chart-pie', group: 'Evento' },
    ];
    if (this.tieneControlInvitados()) {
      items.push({ id: 'invitados', label: 'Invitados', icon: 'pi pi-users', group: 'Invitados', badge: String(this.invitados().length) });
    }
    if (this.tieneControlInvitados() && this.evento()?.modulos?.tipoControlInvitados !== 'lista_puerta') {
      items.push(
        { id: 'croquis', label: 'Mesas', icon: 'pi pi-th-large', group: 'Invitados' },
        { id: 'whatsapp', label: 'Mensajes WA', icon: 'pi pi-whatsapp', group: 'Invitados' },
      );
    }
    if (this.tieneRecepcionOPuerta()) {
      const total = this.evento()?.modulos?.tipoControlInvitados === 'total';
      items.push({ id: 'recepcion', label: total ? 'Recepción & Escáner' : 'Recepción', icon: total ? 'pi pi-qrcode' : 'pi pi-id-card', group: 'Invitados', badge: this.totalIngresados() + '/' + this.totalPases() });
    }
    if (this.tienePlannerSuite()) {
      items.push(
        { id: 'minutario', label: 'Cronograma', icon: 'pi pi-clock', group: 'Organización' },
        { id: 'presupuesto', label: 'Presupuesto', icon: 'pi pi-dollar', group: 'Organización' },
        { id: 'proveedores', label: 'Proveedores', icon: 'pi pi-briefcase', group: 'Organización' },
        { id: 'checklist', label: 'Checklist', icon: 'pi pi-check-square', group: 'Organización' },
      );
    }
    if (this.tieneAlbum()) {
      items.push({ id: 'album', label: 'Álbum', icon: 'pi pi-camera', group: 'Recuerdos', badge: this.recuerdos().length > 0 ? String(this.recuerdos().length) : undefined });
    }
    return items;
  });


  urlInvitacionCompleta = computed(() => {
    const ev = this.evento();
    if (!ev?.enlace) return '';
    return `${window.location.origin}/e/${ev.enlace}`;
  });

  diasRestantesEvento = computed(() => {
    const f = this.evento()?.fecha;
    if (!f) return null;
    const fechaEv = (f as any)?.toDate ? (f as any).toDate() : new Date(f);
    if (isNaN(fechaEv.getTime())) return null;
    const hoy = new Date();
    const f1 = new Date(fechaEv.getFullYear(), fechaEv.getMonth(), fechaEv.getDate());
    const f2 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diffMs = f1.getTime() - f2.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  });

  whatsappShareInvitacionUrl = computed(() => {
    const url = this.urlInvitacionCompleta();
    if (!url) return '';
    const ev = this.evento();
    const titulo = ev?.titulo || 'nuestro evento';
    const msg = `¡Hola! ✨ Te invito a ${titulo}. Puedes ver todos los detalles de la invitación aquí:\n${url}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  });

  async ngOnInit(): Promise<void> {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sincronizarRuta());
    const slug = this.route.snapshot.pathFromRoot.map(part => part.paramMap.get('slug')).find(Boolean);

    if (!slug) {
      this.notFound.set(true);
      this.cargando.set(false);
      return;
    }

    try {
      const ev = await this.portalAccess.load(slug);
      if (ev) {
        this.evento.set(ev);

        this.sincronizarRuta();

        const perfil = await this.usuarioService.esperarInicializacion();
        if (puedeAdministrarSinPin(perfil, ev)) {
          this.accesoStaff.set(true);
          this.rutaPanelStaff = perfil?.rol === 'admin' ? '/admin/eventos' : '/partner/eventos';
          await this.desbloquearYCargar(ev);
        } else {
          const pinSesion = sessionStorage.getItem(`pin_${ev.id}`);
          if (pinSesion && pinSesion === ev.pinAnfitrion) {
            await this.desbloquearYCargar(ev);
          }
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

    sessionStorage.setItem(`pin_${ev.id}`, pin);
    await this.desbloquearYCargar(ev);
  }

  private async desbloquearYCargar(ev: Evento): Promise<void> {
    if (!ev.id) return;
    this.pinDesbloqueado.set(true);

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
    if (this.accesoStaff()) {
      this.qrScannerService.detenerEscaner();
      void this.router.navigate([this.rutaPanelStaff]);
      return;
    }

    const ev = this.evento();

    this.confirmationService.confirm({
      header: 'Cerrar Portal de Anfitrión',
      message: '¿Deseas salir del portal de administración del evento y bloquear el acceso con PIN?',
      icon: 'pi pi-power-off text-amber-500',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Permanecer',
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => {
        if (ev?.id) {
          sessionStorage.removeItem(`pin_${ev.id}`);
        }
        this.qrScannerService.detenerEscaner();
        this.pinDesbloqueado.set(false);
        this.messageService.add({
          severity: 'info',
          summary: 'Portal Bloqueado',
          detail: 'Has salido del portal de anfitrión.',
        });
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'Permaneces en el portal de anfitrión.',
        });
      },
    });
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

  eliminarRecuerdo(recuerdo: RecuerdoModel): void {
    const ev = this.evento();
    if (!ev?.id || !recuerdo.id) return;

    this.confirmationService.confirm({
      header: 'Eliminar Recuerdo del Álbum',
      message: `¿Estás seguro de eliminar el recuerdo enviado por "${recuerdo.nombreAutor || 'Invitado'}"? Se retirará del álbum inmediatamente.`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        this.eliminandoId.set(recuerdo.id!);
        try {
          await this.eventService.eliminarRecuerdo(ev.id!, recuerdo.id!);
          this.recuerdos.update((lista) => lista.filter((r) => r.id !== recuerdo.id));
          this.messageService.add({
            severity: 'success',
            summary: 'Foto Eliminada',
            detail: 'El recuerdo fue eliminado del álbum correctamente.',
          });
        } catch (error) {
          console.error('Error al eliminar recuerdo:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Ocurrió un error al eliminar la foto. Intenta de nuevo.',
          });
        } finally {
          this.eliminandoId.set(null);
        }
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se eliminó ninguna foto.',
        });
      },
    });
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
      header: 'QR para mesas',
      width: '480px',
      breakpoints: { '540px': '94vw' },
      closable: true,
      dismissableMask: true,
      draggable: false,
      focusOnShow: false,
      closeOnEscape: true,
      data: { evento: ev },
    });
  }

  abrirModalDetalle(invitado: InvitadoModel): void {
    const ref = this.dialogService.open(InvitadoDetalleModalComponent, {
      header: 'Detalle del Invitado',
      width: '600px',
      breakpoints: { '660px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        evento: this.evento(),
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.accion === 'editar' && resultado.invitado) {
        this.abrirModalInvitado(resultado.invitado);
      }
    });
  }

  /**
   * ÚNICO MÉTODO/SERVICIO PARA AGREGAR Y EDITAR INVITADOS VÍA DIALOGSERVICE
   */
  abrirModalInvitado(invitado?: InvitadoModel): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const esEdicion = !!invitado;

    const ref = this.dialogService.open(InvitadoFormModalComponent, {
      header: esEdicion ? `Editar Invitado — ${invitado.nombre}` : 'Registrar Nuevo Invitado',
      width: '640px',
      breakpoints: { '700px': '94vw' },
      closable: true,
      draggable: false,

      dismissableMask: true,
      data: {
        eventoId: ev.id,
        invitado,
        invitadosExistentes: this.invitados(),
        evento: ev,
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
      width: '820px',
      breakpoints: { '880px': '94vw' },
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
      header: 'Pase Digital QR',
      width: '620px',
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

  cambiarPestana(
    pestana:
      | 'resumen'
      | 'invitados'
      | 'croquis'
      | 'whatsapp'
      | 'recepcion'
      | 'minutario'
      | 'presupuesto'
      | 'proveedores'
      | 'checklist'
      | 'album',
  ): void {
    void this.router.navigate([PORTAL_PATHS[pestana]], { relativeTo: this.route });
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
    this.portalAccess.clear();
    this.qrScannerService.detenerEscaner();
  }
}
