import { InjectionToken } from '@angular/core';
import type { AnfitrionAsistenciasComponent } from './anfitrion-asistencias.component';

// Routed pages share the existing event state and actions without reloading them.
export const PORTAL_CONTEXT = new InjectionToken<AnfitrionAsistenciasComponent>('PortalContext');
