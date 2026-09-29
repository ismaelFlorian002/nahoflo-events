export const PORTAL_PATHS = {
  resumen: 'resumen',
  invitados: 'invitados',
  croquis: 'mesas',
  whatsapp: 'mensajes',
  recepcion: 'recepcion',
  minutario: 'cronograma',
  presupuesto: 'presupuesto',
  proveedores: 'proveedores',
  checklist: 'checklist',
  album: 'album',
} as const;
export type PortalSection = keyof typeof PORTAL_PATHS;
