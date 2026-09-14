// Tipos de control de invitados según el paquete
export type TipoControlInvitados = 'inactivo' | 'lista_puerta' | 'basico' | 'total';

// Servicios contratados para el evento
export interface ModulosEvento {
  tieneInvitacion: boolean; // Activa la página web (/e/:slug)
  tipoControlInvitados: TipoControlInvitados; // 'inactivo' | 'lista_puerta' (Puerta/Recepción) | 'basico' (RSVP) | 'total' (Pases QR y Escáner Web)
  tieneAlbum: boolean; // Activa el álbum colaborativo para mesas (/e/:slug/album)
}

export interface Evento {
  id?: string;
  estaActivo: boolean; // Interruptor para habilitar/deshabilitar la invitación
  tipo: string; // Ej: "Boda", "XV Años", "Bautizo"

  // Paquete y servicios activos
  modulos?: ModulosEvento;

  // Control interno del panel
  nombreEvento: string; // Ej: "Boda Ale y Felipe - 2026"

  // Textos públicos de la invitación
  preTitulo?: string; // Ej: "Nuestra Boda", "Mis XV Años"
  titulo: string; // Ej: "Alejandra & Felipe"
  enlace: string; // Slug único para la URL: "boda-ale-felipe"
  fecha: Date | string; // Fecha y hora del evento
  mensaje?: string; // Frase / dedicatoria para los invitados

  // Ubicaciones (Ceremonia y Recepción)
  ceremoniaLugar?: string;
  ceremoniaUrl?: string; // Enlace a Google Maps
  recepcionLugar?: string;
  recepcionUrl?: string; // Enlace a Google Maps

  // URLs de las imágenes persistidas en Firebase Storage
  fotoPrincipalUrl?: string;
  fotoCeremoniaUrl?: string;
  fotoRecepcionUrl?: string;
  galeriaUrls?: string[];
  musicaFondoUrl?: string;

  pinAnfitrion?: string; // <-- NUEVO: PIN de 4 a 6 dígitos para los novios/anfitriones

  // Datos del Cliente / Contacto responsable del evento
  clienteId?: string; // Referencia al documento en la colección 'clientes'
  contactoNombre?: string; // Nombre del cliente (denormalizado para vista rápida)
  contactoTelefono?: string; // Teléfono/WhatsApp del cliente
  contactoEmail?: string; // Correo de contacto
  contactoNotas?: string; // Notas de atención o preferencias
}


