// Tipos de control de invitados según el paquete
export type TipoControlInvitados = 'inactivo' | 'lista_puerta' | 'basico' | 'total';

// Servicios contratados para el evento
export interface ModulosEvento {
  tieneInvitacion: boolean; // Activa la página web (/e/:slug)
  tipoControlInvitados: TipoControlInvitados; // 'inactivo' | 'lista_puerta' (Puerta/Recepción) | 'basico' (RSVP) | 'total' (Pases QR y Escáner Web)
  tieneAlbum: boolean; // Activa el álbum colaborativo para mesas (/e/:slug/album)
  tienePlannerSuite?: boolean; // Activa las herramientas avanzadas de Planner (Minutario, Presupuesto, Proveedores, Checklist)
  permiteMarcaBlanca?: boolean; // Activa el Branding de Agencia y descarga de Dossier PDF
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

  // Cronograma / Minutario Técnico del Evento (Fase 2):
  minutario?: ItemMinutario[];

  // Control Financiero y Proveedores (Fase 3):
  presupuesto?: ItemPresupuesto[];
  proveedores?: ProveedorEvento[];

  // Checklist de Planeación por Fases (Fase 4):
  checklist?: TareaPlaneacion[];

  // Marca Blanca / Branding de la Agencia (Fase 5):
  agenciaNombre?: string;
  agenciaLogoUrl?: string;
  agenciaTelefono?: string;
  agenciaNotas?: string;
  // Configuración de Plano / Croquis de Mesas (Croquis Visual):
  mesasLayout?: MesaDiseno[];
  // Plantillas Personalizadas de WhatsApp:
  plantillasWhatsapp?: PlantillaWhatsapp[];
}

export type FormaMesa = 'redonda' | 'rectangular' | 'imperial' | 'cabaret';

export interface MesaDiseno {
  id: string;
  nombre: string; // ej. "Mesa 1", "Mesa VIP", "Mesa Novios"
  forma: FormaMesa; // 'redonda' | 'rectangular' | 'imperial' | 'cabaret'
  capacidad: number; // Capacidad máxima de asientos
  posX?: number; // Coordenada X relativa en el lienzo (%)
  posY?: number; // Coordenada Y relativa en el lienzo (%)
  notas?: string; // Observaciones
}

export interface PlantillaWhatsapp {
  id: string;
  titulo: string; // ej. "Invitación & RSVP Inicial", "Pase VIP con QR"
  categoria: 'invitacion' | 'recordatorio' | 'pase_qr' | 'dia_evento' | 'post_evento' | 'personalizado';
  mensaje: string;
}


export interface ItemMinutario {
  id: string;
  hora: string; // ej. "16:30"
  actividad: string; // ej. "Entrada de los Novios"
  responsable?: string; // ej. "Coordinador", "DJ / Orquesta", "Banquetero", "Fotógrafo"
  detalles?: string; // ej. "Chisperos fríos encendidos"
  completado?: boolean; // Estado en vivo durante el evento
}

export interface ItemPresupuesto {
  id: string;
  categoria: string; // ej. "Banquete & Bebidas", "Música & DJ", "Decoración & Flores", "Fotografía & Video", "Lugar / Salón", "Vestido & Imagen", "Recuerdos & Papelería", "Coordinación & Planner", "Otros"
  concepto: string; // ej. "Anticipo Banquete 150 Personas"
  costoEstimado: number;
  costoReal: number;
  montoPagado: number;
  estadoPago: 'pendiente' | 'parcial' | 'pagado';
  fechaLimitePago?: string | Date;
  proveedorNombre?: string;
  notas?: string;
}

export interface ProveedorEvento {
  id: string;
  categoria: string; // ej. "DJ / Música", "Fotógrafo", "Florista", "Banquete", "Maquillaje", "Salón", "Decoración"
  empresa: string;
  contactoNombre?: string;
  telefono?: string;
  email?: string;
  montoContrato?: number;
  notas?: string;
}

export interface TareaPlaneacion {
  id: string;
  fase: string; // ej. "12 a 9 Meses Antes", "6 a 3 Meses Antes", "1 Mes Antes", "Semana del Evento", "Día del Evento"
  titulo: string; // ej. "Reservar Banquete y Salón"
  responsable?: string; // ej. "Wedding Planner", "Novia", "Novio", "Ambos"
  fechaLimite?: string;
  completada: boolean;
  prioridad?: 'alta' | 'media' | 'baja';
  notas?: string;
}




