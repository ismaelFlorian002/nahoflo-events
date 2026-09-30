export interface ClienteModel {
  id?: string;
  nombreCompleto: string;
  telefono: string; // Para contacto y WhatsApp directo
  email?: string;
  notas?: string;
  creadoEn: Date | string;
  totalEventos?: number;

  /**
   * Firebase Auth UID del Partner que registró a este cliente.
   * Permite que Firestore Rules restrinja el acceso solo al Partner dueño.
   * null → cliente creado directamente por un Admin.
   */
  partnerId?: string | null;
  creadoPorUid?: string | null;
  creadoPorNombre?: string | null;
  esDirecto?: boolean;
}
