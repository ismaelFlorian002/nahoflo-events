import { Component, signal } from '@angular/core';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EventService } from '../../core/services/event.service';
import { AccesoAnfitrionService } from '../../core/services/acceso-anfitrion.service';
import { Evento } from '../../core/models/event.model';
import { AnfitrionAsistenciasComponent } from './anfitrion-asistencias.component';
import { PortalEventAccess, portalSectionGuard } from './portal-access';
import { PORTAL_ROUTES } from './portal.routes';
import { QrScannerService } from './services/qr-scanner.service';
import { PdfReportService } from './services/pdf-report.service';
import { ZipDownloaderService } from './services/zip-downloader.service';

@Component({ template: 'Section content' })
class TestPage {}

describe('Portal routes', () => {
  let event: Evento;
  const stop = vi.fn();
  const events = { getEventBySlug: vi.fn(), getInvitados: vi.fn(), getRecuerdos: vi.fn() };
  let sesionVigente = false;
  const acceso = {
    tieneSesionVigente: vi.fn(async () => sesionVigente),
    cerrarSesion: vi.fn(async () => undefined),
  };

  beforeEach(async () => {
    sesionVigente = false;
    vi.clearAllMocks();
    event = { id: 'test-event', enlace: 'test', titulo: 'Test', pinLongitud: 6 } as Evento;
    events.getEventBySlug.mockImplementation(async () => event);
    events.getInvitados.mockResolvedValue([]);
    events.getRecuerdos.mockResolvedValue([]);
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideLocationMocks(),
        ConfirmationService,
        MessageService,
        { provide: EventService, useValue: events },
        { provide: AccesoAnfitrionService, useValue: acceso },
        { provide: QrScannerService, useValue: { detenerEscaner: stop, escanerActivo: signal(false) } },
        { provide: PdfReportService, useValue: {} },
        {
          provide: ZipDownloaderService,
          useValue: { descargandoTodo: signal(false), progresoDescarga: signal('') },
        },
        provideRouter([
          {
            path: 'e/:slug/asistencias',
            component: AnfitrionAsistenciasComponent,
            providers: [PortalEventAccess],
            canActivateChild: [portalSectionGuard],
            children: PORTAL_ROUTES.map((route) =>
              route.loadComponent ? { ...route, loadComponent: async () => TestPage } : route,
            ),
          },
        ]),
      ],
    }).compileComponents();
  });

  it('renders every real lazy page with the shared event context', async () => {
    const router = TestBed.inject(Router);
    router.resetConfig(router.config.map(route => ({ ...route, children: PORTAL_ROUTES })));
    sesionVigente = true;
    const harness = await RouterTestingHarness.create();
    for (const route of PORTAL_ROUTES.filter(route => route.loadComponent)) {
      const shell = await harness.navigateByUrl(`/e/test/asistencias/${route.path}`, AnfitrionAsistenciasComponent);
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(shell.pestanaActiva()).toBe(route.data!['section']);
      expect(harness.routeNativeElement?.textContent?.trim().length).toBeGreaterThan(0);
      const links = Array.from(harness.routeNativeElement!.querySelectorAll('.sidebar-nav a'));
      expect(links.length).toBe(10);
      expect(links.every(link => link.getAttribute('href')?.startsWith('/e/test/asistencias/'))).toBe(true);
    }
    expect(events.getEventBySlug).toHaveBeenCalledTimes(1);
  });

  it('keeps a direct URL behind the PIN and opens it after unlocking', async () => {
    const harness = await RouterTestingHarness.create();
    const shell = await harness.navigateByUrl(
      '/e/test/asistencias/mesas',
      AnfitrionAsistenciasComponent,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('PIN');
    expect(shell.pestanaActiva()).toBe('croquis');
    await shell.onPinValido();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Section content');
    expect(TestBed.inject(Router).url).toBe('/e/test/asistencias/mesas');
  });

  it('preserves the container and loaded data when changing sections and stops the scanner', async () => {
    sesionVigente = true;
    const harness = await RouterTestingHarness.create();
    const first = await harness.navigateByUrl(
      '/e/test/asistencias/recepcion',
      AnfitrionAsistenciasComponent,
    );
    await harness.fixture.whenStable();
    stop.mockClear();
    const next = await harness.navigateByUrl(
      '/e/test/asistencias/invitados',
      AnfitrionAsistenciasComponent,
    );
    expect(next).toBe(first);
    expect(next.pestanaActiva()).toBe('invitados');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(events.getEventBySlug).toHaveBeenCalledTimes(1);
    expect(events.getInvitados).toHaveBeenCalledTimes(1);
  });

  it('resolves the legacy entry and unknown sections inside the portal', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/e/test/asistencias');
    expect(TestBed.inject(Router).url).toBe('/e/test/asistencias/resumen');
    await harness.navigateByUrl('/e/test/asistencias/no-existe');
    expect(TestBed.inject(Router).url).toBe('/e/test/asistencias/resumen');
  });

  it('keeps the selected section synchronized with browser back and forward', async () => {
    const harness = await RouterTestingHarness.create();
    const shell = await harness.navigateByUrl(
      '/e/test/asistencias/mesas',
      AnfitrionAsistenciasComponent,
    );
    await harness.fixture.whenStable();
    await harness.navigateByUrl('/e/test/asistencias/cronograma');
    const router = TestBed.inject(Router);
    router.setUpLocationChangeListener();
    const location = TestBed.inject(Location);
    const back = firstValueFrom(
      router.events.pipe(
        filter((e) => e instanceof NavigationEnd),
        timeout(2000),
      ),
    );
    location.back();
    await back;
    expect(shell.pestanaActiva()).toBe('croquis');
    const forward = firstValueFrom(
      router.events.pipe(
        filter((e) => e instanceof NavigationEnd),
        timeout(2000),
      ),
    );
    location.forward();
    await forward;
    expect(shell.pestanaActiva()).toBe('minutario');
  });

  it('rejects direct links to unavailable modules and preserves album-only defaults', async () => {
    event.modulos = {
      tipoControlInvitados: 'inactivo',
      tieneAlbum: true,
      tienePlannerSuite: false,
    } as Evento['modulos'];
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/e/test/asistencias/presupuesto');
    expect(TestBed.inject(Router).url).toBe('/e/test/asistencias/album');
    await harness.navigateByUrl('/e/test/asistencias/mesas');
    expect(TestBed.inject(Router).url).toBe('/e/test/asistencias/album');
  });
});
