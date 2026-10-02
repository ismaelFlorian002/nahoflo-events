import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout.component';
import { AdminLayoutComponent } from './shared/layouts/admin-layout/admin-layout.component';
import { EventLayout } from './shared/layouts/event-layout/event-layout.component';

// Guards RBAC (Paso 3)
import { adminGuard }                   from './core/guards/admin.guard';
import { panelGuard }                   from './core/guards/panel.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';
import { pinGuard }                     from './core/guards/pin.guard';

// Guard de sección del portal (existente - Paso 1 original)
import { PortalEventAccess, portalSectionGuard } from './features/anfitrion-asistencias/portal-access';

/** Redirige las URLs anteriores por rol (/admin/**, /partner/**) a su equivalente en /panel. */
const redireccionesPanel: Routes = [
  { path: '', redirectTo: '/panel', pathMatch: 'full' },
  { path: 'dashboard', redirectTo: '/panel', pathMatch: 'full' },
  { path: ':seccion', redirectTo: '/panel/:seccion' },
];

export const routes: Routes = [

  // ── Raíz (Landing Page pública) ───────────────────────────────────────────
  {
    path: '',
    component: PublicLayout,
    children: [],
  },

  // ── Login ─────────────────────────────────────────────────────────────────
  // redirectIfAuthenticatedGuard: redirige al workspace si ya tienes sesión
  {
    path: 'login',
    canActivate: [redirectIfAuthenticatedGuard],
    loadComponent: () =>
      import('./features/admin/login/login.component').then(m => m.LoginComponent),
  },

  // ── Panel (admin y partner) ──────────────────────────────────────────────
  // panelGuard: usuarios activos con rol 'admin' o 'partner'.
  // Cada pantalla filtra datos y opciones según el rol del perfil.
  {
    path: 'panel',
    component: AdminLayoutComponent,
    canActivate: [panelGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/admin/panel/panel.component').then(m => m.PanelComponent),
      },
      {
        path: 'eventos',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/admin/clientes/clientes.component').then(m => m.ClientesComponent),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/partners/partners.component').then(m => m.PartnersComponent),
      },
      {
        path: 'partners',
        redirectTo: 'usuarios',
        pathMatch: 'full',
      },
    ],
  },
  { path: 'admin', children: redireccionesPanel },
  { path: 'partner', children: redireccionesPanel },

  // ── Rutas del Evento (públicas con sub-rutas protegidas por PIN) ──────────
  {
    path: 'e/:slug',
    component: EventLayout,
    children: [
      // Invitación pública — sin guard
      {
        path: '',
        loadComponent: () =>
          import('./features/invitation/invitation.component').then(m => m.InvitationComponent),
      },
      // Álbum colaborativo — sin guard (acceso público desde mesas)
      {
        path: 'album',
        loadComponent: () =>
          import('./features/album-digital/album-digital.component').then(m => m.AlbumDigitalComponent),
      },
      // Portal del Anfitrión / Host
      // pinGuard:          restaura sesión de PIN y arranca auth anónima de Firebase
      // portalSectionGuard: valida que la sección esté habilitada en los módulos del evento
      {
        path: 'asistencias',
        canActivate: [pinGuard],
        providers: [PortalEventAccess],
        canActivateChild: [portalSectionGuard],
        loadComponent: () =>
          import('./features/anfitrion-asistencias/anfitrion-asistencias.component').then(
            m => m.AnfitrionAsistenciasComponent,
          ),
        loadChildren: () =>
          import('./features/anfitrion-asistencias/portal.routes').then(m => m.PORTAL_ROUTES),
      },
    ],
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
