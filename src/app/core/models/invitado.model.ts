export interface InvitadoModel {
  id?: string;
  nombre: string; // Nombre del invitado o familia (ej. Familia Pérez)
  asistira: boolean; // true = Asistirá | false = No podrá asistir
  pasesConfirmados: number; // Cantidad de personas (1, 2, 3...)
  telefono?: string; // Opcional para contacto
  mensaje?: string; // Mensaje o buenos deseos para los anfitriones
  fechaConfirmacion?: any; // Fecha y hora en que se envió la confirmación
}
