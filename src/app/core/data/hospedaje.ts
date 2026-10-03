import { Hospedaje, HotelSugerido } from '../models/event.model';
import { nuevoIdItinerario } from './plantillas-itinerario';

export const DISTANCIAS_HOTEL: string[] = [
  'En el mismo lugar del evento',
  'Caminando, a menos de 5 min',
  'A 5 min en auto',
  'A 10 min en auto',
  'A 15 min en auto',
  'A 20 min en auto',
  'A 30 min en auto',
  'A 45 min en auto',
  'A 1 hora en auto',
  'A más de 1 hora en auto',
];

export function hospedajeVacio(): Hospedaje {
  return {
    activo: false,
    mensaje: 'Para tu comodidad, te compartimos algunas opciones de hospedaje cerca del lugar del evento.',
    hoteles: [],
  };
}

export function nuevoHotel(): HotelSugerido {
  return {
    id: nuevoIdItinerario(),
    nombre: '',
    estrellas: 0,
    recomendado: false,
    direccion: '',
    mapsUrl: '',
    distancia: '',
    precioNoche: null,
    codigo: '',
    reservarAntes: '',
    telefono: '',
    whatsapp: '',
    url: '',
    notas: '',
  };
}

/** Agrega https:// cuando el enlace se capturó sin protocolo. */
export function normalizarUrl(url: string | undefined): string {
  const limpia = (url || '').trim();
  if (!limpia) return '';
  return /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
}

/** 'YYYY-MM-DD' → Date local (sin desfase por zona horaria). */
export function fechaDesdeIso(iso: string | undefined): Date | null {
  const [a, m, d] = (iso || '').split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

export function isoDesdeFecha(fecha: Date | null | undefined): string {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}
