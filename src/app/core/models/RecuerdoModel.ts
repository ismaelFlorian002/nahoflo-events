export interface RecuerdoModel {
  id?: string;
  nombreAutor: string; // Nombre del invitado que tomó la foto
  mensaje?: string; // Frase o dedicatoria para los anfitriones
  fotoUrl: string; // URL en Firebase Storage
  creadoEn: Date | string; // Fecha y hora en que se tomó la foto
  estaAprobado?: boolean; // Para moderación del anfitrión (por defecto true)
  meGusta?: number; // <-- NUEVO: Contador de likes de la foto
  comentarios?: ComentarioModel[];

}
// Modelo para los comentarios de los invitados en cada foto
export interface ComentarioModel {
  id?: string;
  autor: string; // Nombre del invitado (ej. "Tía Carmen")
  texto: string; // El comentario o felicitación
  creadoEn: Date | string;
}
