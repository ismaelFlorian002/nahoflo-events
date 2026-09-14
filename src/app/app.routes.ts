import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout';
import { AdminLayoutComponent } from './shared/layouts/admin-layout/admin-layout';
import { EventLayout } from './shared/layouts/event-layout/event-layout';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '', // Ruta raíz (Landing Page)
    component: PublicLayout,
    children: [
      // Más adelante cargaremos las páginas hijas aquí con Lazy Loading
    ],
  },
  // Agrega este bloque antes del path: 'admin'
  {
    path: 'login',
    // Lazy Loading moderno: Solo descarga el código del login si el usuario entra a /login
    loadComponent: () => import('./features/admin/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '', // Al entrar a /admin, cargará el Dashboard por defecto
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'eventos',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/admin/clientes/clientes.component').then((m) => m.ClientesComponent),
      },
    ],
  },
  {
    path: 'e/:slug', // Slug amigable del evento (ej. /e/boda-ale-felipe)
    component: EventLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/invitation/invitation.component').then((m) => m.InvitationComponent),
      },
      // Panel privado para los novios/anfitriones
      {
        path: 'asistencias',
        loadComponent: () =>
          import('./features/anfitrion-asistencias/anfitrion-asistencias.component').then(
            (m) => m.AnfitrionAsistenciasComponent,
          ),
      },
      // <--- AGREGAR AQUÍ LA RUTA DEL ÁLBUM DIGITAL
      {
        path: 'album',
        loadComponent: () =>
          import('./features/album-digital/album-digital').then((m) => m.AlbumDigitalComponent),
      },
    ],
  },
  {
    path: '**', // Ruta comodín (si alguien escribe una URL que no existe)
    redirectTo: '',
    pathMatch: 'full',
  },
];
