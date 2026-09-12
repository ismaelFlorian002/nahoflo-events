export interface RecuerdoModel {
  id?: string;
  nombreAutor: string;
  mensaje?: string;

  // Retrocompatibilidad con publicaciones previas de 1 foto
  fotoUrl?: string;

  // Arreglo de URLs para el carrusel tipo Instagram (N fotos)
  fotosUrls: string[];

  creadoEn: Date | string;
  estaAprobado?: boolean;
  meGusta?: number;
  comentarios?: ComentarioModel[];
}

// Modelo para los comentarios y respuestas anidadas estilo Instagram
export interface ComentarioModel {
  id: string;
  autor: string; // Nombre del invitado (ej: "Victor")
  texto: string; // El comentario o felicitación
  creadoEn: Date | string;
  meGusta?: number; // Likes individuales en el comentario

  // Datos para respuestas anidadas
  respondiendoA?: string; // Nombre de la persona a quien le responde (ej: "Victor")
  respuestas?: ComentarioModel[]; // Hilo de respuestas hijas
}
