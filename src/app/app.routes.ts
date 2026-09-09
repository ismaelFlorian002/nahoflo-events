import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout';
import { AdminLayoutComponent } from './shared/layouts/admin-layout/admin-layout';
import { EventLayout } from './shared/layouts/event-layout/event-layout';
import { authGuard } from './core/guards/auth-guard';
import { DashboardComponent } from './features/admin/dashboard/dashboard';


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
          import('./features/admin/dashboard/dashboard').then(
            (m) => m.DashboardComponent,
          ),
      },
    ],
  },
  {
    path: 'e/:eventId', // Ruta dinámica para los eventos (Ej. /e/mis-xv-nahomi)
    component: EventLayout,
    children: [
      // Más adelante cargaremos la Invitación y el Álbum aquí
    ],
  },
  {
    path: '**', // Ruta comodín (si alguien escribe una URL que no existe)
    redirectTo: '',
    pathMatch: 'full',
  },
];
