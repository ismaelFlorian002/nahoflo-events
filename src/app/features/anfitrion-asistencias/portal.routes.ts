import { Routes } from '@angular/router';
import { PORTAL_PATHS, PortalSection } from './portal-sections';

const pages = {
  resumen: () => import('./pages/resumen.page').then((m) => m.ResumenPage),
  invitados: () => import('./pages/invitados.page').then((m) => m.InvitadosPage),
  croquis: () => import('./pages/croquis.page').then((m) => m.CroquisPage),
  whatsapp: () => import('./pages/whatsapp.page').then((m) => m.WhatsappPage),
  recepcion: () => import('./pages/recepcion.page').then((m) => m.RecepcionPage),
  minutario: () => import('./pages/minutario.page').then((m) => m.MinutarioPage),
  presupuesto: () => import('./pages/presupuesto.page').then((m) => m.PresupuestoPage),
  proveedores: () => import('./pages/proveedores.page').then((m) => m.ProveedoresPage),
  checklist: () => import('./pages/checklist.page').then((m) => m.ChecklistPage),
  album: () => import('./pages/album.page').then((m) => m.AlbumPage),
};

export const PORTAL_ROUTES: Routes = [
  ...Object.entries(PORTAL_PATHS).map(([id, path]) => ({
    path,
    data: { section: id },
    loadComponent: pages[id as PortalSection],
  })),
  { path: '', pathMatch: 'full', children: [] },
  { path: '**', redirectTo: '' },
];
