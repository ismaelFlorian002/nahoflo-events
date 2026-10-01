import { Injectable, inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { PerfilUsuario } from '../../core/models/usuario.model';
import { PORTAL_PATHS, PortalSection } from './portal-sections';

export function puedeAdministrarSinPin(perfil: PerfilUsuario | null, event: Evento): boolean {
  if (!perfil?.estaActivo) return false;
  if (perfil.rol === 'admin') return true;
  return perfil.rol === 'partner' && (event.ownerId === perfil.uid || event.creadoPorUid === perfil.uid);
}

export function initialPortalSection(event: Evento): PortalSection {
  return event.modulos?.tipoControlInvitados === 'inactivo' && event.modulos?.tieneAlbum
    ? 'album'
    : 'resumen';
}

export function availablePortalSections(event: Evento): PortalSection[] {
  const mod = event.modulos;
  const sections: PortalSection[] = ['resumen'];
  if (!mod || mod.tipoControlInvitados !== 'inactivo') {
    sections.push('invitados');
    if (mod?.tipoControlInvitados !== 'lista_puerta') sections.push('croquis', 'whatsapp');
  }
  if (!mod || ['total', 'lista_puerta', 'basico'].includes(mod.tipoControlInvitados))
    sections.push('recepcion');
  if (!mod || (mod.tienePlannerSuite ?? true))
    sections.push('minutario', 'presupuesto', 'proveedores', 'checklist');
  if (!mod || mod.tieneAlbum) sections.push('album');
  return sections;
}

@Injectable()
export class PortalEventAccess {
  private readonly events = inject(EventService);
  private slug?: string;
  private pending?: Promise<Evento | null>;

  load(slug: string): Promise<Evento | null> {
    if (slug !== this.slug || !this.pending) {
      this.slug = slug;
      this.pending = this.events.getEventBySlug(slug);
    }
    return this.pending;
  }

  update(event: Evento): void {
    this.pending = Promise.resolve(event);
  }
  clear(): void {
    this.pending = undefined;
  }
}

export const portalSectionGuard: CanActivateChildFn = async (route) => {
  const access = inject(PortalEventAccess);
  const router = inject(Router);
  const slug = route.pathFromRoot.map((part) => part.paramMap.get('slug')).find(Boolean);
  if (!slug) return false;
  let event: Evento | null;
  try {
    event = await access.load(slug);
  } catch {
    return true;
  }
  // The container retains its existing unavailable-event and PIN screens.
  if (!event) return true;
  const section = route.data['section'] as PortalSection | undefined;
  if (section && availablePortalSections(event).includes(section)) return true;
  return router.createUrlTree([
    '/e',
    slug,
    'asistencias',
    PORTAL_PATHS[initialPortalSection(event)],
  ]);
};
