import { ItemItinerario } from '../models/event.model';

export interface IconoItinerario {
  icono: string;
  label: string;
}

export const ICONOS_ITINERARIO: IconoItinerario[] = [
  { icono: 'pi-heart', label: 'Ceremonia' },
  { icono: 'pi-camera', label: 'Fotos' },
  { icono: 'pi-sparkles', label: 'Cóctel / brindis' },
  { icono: 'pi-crown', label: 'Entrada' },
  { icono: 'pi-star', label: 'Momento especial' },
  { icono: 'pi-users', label: 'Cena / convivencia' },
  { icono: 'pi-gift', label: 'Pastel / regalos' },
  { icono: 'pi-headphones', label: 'Música / baile' },
  { icono: 'pi-microphone', label: 'Discursos' },
  { icono: 'pi-bolt', label: 'Sorpresa' },
  { icono: 'pi-car', label: 'Traslado' },
  { icono: 'pi-flag', label: 'Inicio / cierre' },
  { icono: 'pi-moon', label: 'Despedida' },
  { icono: 'pi-clock', label: 'Otro' },
];

interface PasoPlantilla {
  /** Minutos después de la hora de inicio del evento. */
  minutos: number;
  titulo: string;
  descripcion?: string;
  icono: string;
}

export interface PlantillaItinerario {
  id: string;
  nombre: string;
  icono: string;
  pasos: PasoPlantilla[];
}

export const PLANTILLAS_ITINERARIO: PlantillaItinerario[] = [
  {
    id: 'boda',
    nombre: 'Boda',
    icono: 'pi-heart',
    pasos: [
      { minutos: 0, titulo: 'Ceremonia', descripcion: 'Acompáñanos a dar el sí', icono: 'pi-heart' },
      { minutos: 60, titulo: 'Sesión de fotos', descripcion: 'Fotos con familiares y amigos', icono: 'pi-camera' },
      { minutos: 90, titulo: 'Cóctel de bienvenida', icono: 'pi-sparkles' },
      { minutos: 150, titulo: 'Entrada de los novios', icono: 'pi-crown' },
      { minutos: 165, titulo: 'Primer baile', icono: 'pi-star' },
      { minutos: 195, titulo: 'Cena', icono: 'pi-users' },
      { minutos: 255, titulo: 'Brindis y pastel', icono: 'pi-gift' },
      { minutos: 285, titulo: '¡A bailar!', icono: 'pi-headphones' },
      { minutos: 480, titulo: 'Despedida', icono: 'pi-moon' },
    ],
  },
  {
    id: 'xv',
    nombre: 'XV Años',
    icono: 'pi-crown',
    pasos: [
      { minutos: 0, titulo: 'Misa de acción de gracias', icono: 'pi-heart' },
      { minutos: 90, titulo: 'Recepción', icono: 'pi-sparkles' },
      { minutos: 120, titulo: 'Entrada de la quinceañera', icono: 'pi-crown' },
      { minutos: 135, titulo: 'Vals', icono: 'pi-star' },
      { minutos: 165, titulo: 'Cena', icono: 'pi-users' },
      { minutos: 225, titulo: 'Brindis y pastel', icono: 'pi-gift' },
      { minutos: 240, titulo: 'Baile sorpresa', icono: 'pi-bolt' },
      { minutos: 255, titulo: '¡Fiesta!', icono: 'pi-headphones' },
      { minutos: 420, titulo: 'Despedida', icono: 'pi-moon' },
    ],
  },
  {
    id: 'bautizo',
    nombre: 'Bautizo',
    icono: 'pi-sun',
    pasos: [
      { minutos: 0, titulo: 'Ceremonia de bautizo', icono: 'pi-heart' },
      { minutos: 60, titulo: 'Fotos familiares', icono: 'pi-camera' },
      { minutos: 90, titulo: 'Recepción', icono: 'pi-sparkles' },
      { minutos: 120, titulo: 'Comida', icono: 'pi-users' },
      { minutos: 180, titulo: 'Pastel y recuerdos', icono: 'pi-gift' },
      { minutos: 240, titulo: 'Despedida', icono: 'pi-moon' },
    ],
  },
  {
    id: 'cumpleanos',
    nombre: 'Cumpleaños',
    icono: 'pi-gift',
    pasos: [
      { minutos: 0, titulo: 'Bienvenida', icono: 'pi-sparkles' },
      { minutos: 60, titulo: 'Cena', icono: 'pi-users' },
      { minutos: 120, titulo: 'Pastel y mañanitas', icono: 'pi-gift' },
      { minutos: 150, titulo: '¡Fiesta!', icono: 'pi-headphones' },
      { minutos: 300, titulo: 'Despedida', icono: 'pi-moon' },
    ],
  },
  {
    id: 'general',
    nombre: 'Corporativo / General',
    icono: 'pi-briefcase',
    pasos: [
      { minutos: 0, titulo: 'Registro y bienvenida', icono: 'pi-users' },
      { minutos: 30, titulo: 'Palabras de apertura', icono: 'pi-microphone' },
      { minutos: 60, titulo: 'Programa principal', icono: 'pi-star' },
      { minutos: 120, titulo: 'Comida y networking', icono: 'pi-sparkles' },
      { minutos: 180, titulo: 'Cierre y agradecimientos', icono: 'pi-flag' },
    ],
  },
];

/** `crypto.randomUUID` solo existe en contextos seguros; en HTTP por IP de red local se usa un respaldo. */
export function nuevoIdItinerario(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Genera los momentos de una plantilla a partir de la hora de inicio del evento ("HH:mm"). */
export function construirItinerario(plantilla: PlantillaItinerario, horaInicio: string): ItemItinerario[] {
  const [h, m] = horaInicio.split(':').map(Number);
  const base = (h || 0) * 60 + (m || 0);
  return plantilla.pasos.map((paso) => {
    const total = (base + paso.minutos) % (24 * 60);
    const hora = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return {
      id: nuevoIdItinerario(),
      hora,
      titulo: paso.titulo,
      descripcion: paso.descripcion || '',
      icono: paso.icono,
    };
  });
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Ordena por hora tomando como referencia 3 h antes del inicio del evento: así lo posterior a
 * medianoche queda al final y lo que ocurre poco antes del inicio sigue al principio.
 */
export function ordenarItinerario<T extends Pick<ItemItinerario, 'hora'>>(items: T[], horaInicio: string): T[] {
  const inicio = aMinutos(horaInicio) - 180;
  const clave = (hora: string) => (aMinutos(hora) - inicio + 24 * 60) % (24 * 60);
  return [...items].sort((a, b) => clave(a.hora) - clave(b.hora));
}

export function plantillaSugerida(tipoEvento: string | null | undefined): string {
  const tipo = (tipoEvento || '').toLowerCase();
  if (tipo.includes('boda')) return 'boda';
  if (tipo.includes('xv') || tipo.includes('quince')) return 'xv';
  if (tipo.includes('bautizo')) return 'bautizo';
  if (tipo.includes('cumple')) return 'cumpleanos';
  return 'general';
}
