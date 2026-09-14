export interface ClienteModel {
  id?: string;
  nombreCompleto: string;
  telefono: string; // Para contacto y WhatsApp directo
  email?: string;
  notas?: string;
  creadoEn: Date | string;
  totalEventos?: number;
}
