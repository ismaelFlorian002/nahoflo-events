import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout.component';
import { AdminLayoutComponent } from './shared/layouts/admin-layout/admin-layout.component';
import { EventLayout } from './shared/layouts/event-layout/event-layout.component';

// Guards RBAC (Paso 3)
import { adminGuard }                   from './core/guards/admin.guard';
import { partnerGuard }                 from './core/guards/partner.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';
import { pinGuard }                     from './core/guards/pin.guard';

// Guard de sección del portal (existente - Paso 1 original)
import { PortalEventAccess, portalSectionGuard } from './features/anfitrion-asistencias/portal-access';

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

  // ── Panel Admin ──────────────────────────────────────────────────────────
  // adminGuard: solo usuarios con rol 'admin' y estaActivo=true
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'eventos',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/admin/clientes/clientes.component').then(m => m.ClientesComponent),
      },
      {
        path: 'usuarios',
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

  // ── Workspace Partner ────────────────────────────────────────────────────
  // partnerGuard: Partners activos + Admins (para soporte)
  // Usa AdminLayoutComponent temporalmente hasta crear PartnerLayoutComponent en Paso 4
  {
    path: 'partner',
    component: AdminLayoutComponent,
    canActivate: [partnerGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
        // El DashboardComponent filtrará automáticamente por ownerId en el Paso 4
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/admin/clientes/clientes.component').then(m => m.ClientesComponent),
      },
    ],
  },

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
