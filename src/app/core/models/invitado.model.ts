export type EstadoInvitado = 'pendiente' | 'confirmado' | 'declinado';

export interface InvitadoModel {
  id?: string;
  nombre: string; // Nombre del invitado o familia (ej. Familia Pérez)
  asistira: boolean; // true = Asistirá | false = No podrá asistir o pendiente
  estado?: EstadoInvitado; // 'pendiente' | 'confirmado' | 'declinado'
  pasesConfirmados: number; // Cantidad de personas (1, 2, 3...)
  telefono?: string; // Opcional para contacto
  mensaje?: string; // Mensaje o buenos deseos para los anfitriones
  fechaConfirmacion?: any; // Fecha y hora en que se envió la confirmación

  // Control Total VIP:
  haIngresado?: boolean; // true si ya cruzó la recepción
  horaIngreso?: any; // Timestamp de llegada
  pasesIngresados?: number; // Personas que ingresaron efectivamente
  codigoAcceso?: string; // Token único del pase para el QR
}

