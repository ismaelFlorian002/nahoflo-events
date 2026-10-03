import { ColorSugerido, DressCode } from '../models/event.model';

export interface EstiloVestimenta {
  id: string;
  titulo: string;
  icono: string;
  descripcion: string;
  ellas: string;
  ellos: string;
}

export const ESTILOS_VESTIMENTA: EstiloVestimenta[] = [
  {
    id: 'etiqueta',
    titulo: 'Etiqueta rigurosa',
    icono: 'pi-crown',
    descripcion: 'La máxima formalidad para una noche inolvidable.',
    ellas: 'Vestido largo de noche.',
    ellos: 'Esmoquin o frac con moño negro.',
  },
  {
    id: 'formal',
    titulo: 'Formal',
    icono: 'pi-star',
    descripcion: 'Elegancia clásica para celebrar en grande.',
    ellas: 'Vestido largo o midi elegante.',
    ellos: 'Traje oscuro con corbata.',
  },
  {
    id: 'cocktail',
    titulo: 'Cocktail',
    icono: 'pi-sparkles',
    descripcion: 'Elegante, pero con un toque más relajado y festivo.',
    ellas: 'Vestido corto o midi de cóctel.',
    ellos: 'Traje con o sin corbata.',
  },
  {
    id: 'semiformal',
    titulo: 'Semiformal',
    icono: 'pi-heart',
    descripcion: 'Arreglado y cómodo para disfrutar toda la fiesta.',
    ellas: 'Vestido midi, conjunto elegante o jumpsuit.',
    ellos: 'Pantalón de vestir, camisa y saco opcional.',
  },
  {
    id: 'casual-elegante',
    titulo: 'Casual elegante',
    icono: 'pi-sun',
    descripcion: 'Ideal para jardín o playa: fresco pero arreglado.',
    ellas: 'Vestido fresco o conjunto de lino.',
    ellos: 'Guayabera o camisa de lino, pantalón claro.',
  },
  {
    id: 'tematico',
    titulo: 'Temático',
    icono: 'pi-palette',
    descripcion: 'Sigue la temática del evento y diviértete con tu look.',
    ellas: '',
    ellos: '',
  },
  {
    id: 'personalizado',
    titulo: 'Personalizado',
    icono: 'pi-pencil',
    descripcion: '',
    ellas: '',
    ellos: '',
  },
];

export interface PaletaColores {
  id: string;
  nombre: string;
  colores: ColorSugerido[];
}

export const PALETAS_COLORES: PaletaColores[] = [
  {
    id: 'tierra',
    nombre: 'Tonos tierra',
    colores: [
      { hex: '#c08457', nombre: 'Terracota' },
      { hex: '#a47148', nombre: 'Canela' },
      { hex: '#d9b99b', nombre: 'Arena' },
      { hex: '#6b705c', nombre: 'Olivo' },
      { hex: '#7f5539', nombre: 'Chocolate' },
    ],
  },
  {
    id: 'pastel',
    nombre: 'Pasteles',
    colores: [
      { hex: '#f4c2c2', nombre: 'Rosa palo' },
      { hex: '#c3b1e1', nombre: 'Lavanda' },
      { hex: '#a7c7e7', nombre: 'Azul cielo' },
      { hex: '#b8e0d2', nombre: 'Menta' },
      { hex: '#fde4b2', nombre: 'Durazno' },
    ],
  },
  {
    id: 'jardin',
    nombre: 'Jardín',
    colores: [
      { hex: '#7a8b6f', nombre: 'Salvia' },
      { hex: '#4f6f52', nombre: 'Verde bosque' },
      { hex: '#d4a5a5', nombre: 'Rosa empolvado' },
      { hex: '#e9dcc9', nombre: 'Lino' },
      { hex: '#c9a227', nombre: 'Dorado' },
    ],
  },
  {
    id: 'noche',
    nombre: 'Noche elegante',
    colores: [
      { hex: '#1f2a44', nombre: 'Azul marino' },
      { hex: '#5b1a2e', nombre: 'Vino' },
      { hex: '#2f4f4f', nombre: 'Verde esmeralda' },
      { hex: '#3d3d3d', nombre: 'Gris oxford' },
      { hex: '#b08d57', nombre: 'Bronce' },
    ],
  },
  {
    id: 'neutros',
    nombre: 'Neutros',
    colores: [
      { hex: '#000000', nombre: 'Negro' },
      { hex: '#6b6b6b', nombre: 'Gris' },
      { hex: '#c8b8a6', nombre: 'Taupe' },
      { hex: '#e8e1d5', nombre: 'Hueso' },
      { hex: '#a39171', nombre: 'Caqui' },
    ],
  },
  {
    id: 'playa',
    nombre: 'Playa',
    colores: [
      { hex: '#5fa8d3', nombre: 'Turquesa' },
      { hex: '#f2cc8f', nombre: 'Arena dorada' },
      { hex: '#e07a5f', nombre: 'Coral' },
      { hex: '#81b29a', nombre: 'Verde agua' },
      { hex: '#f4f1de', nombre: 'Marfil' },
    ],
  },
];

export const COLORES_EVITAR_RAPIDOS: ColorSugerido[] = [
  { hex: '#ffffff', nombre: 'Blanco' },
  { hex: '#f5f0e1', nombre: 'Marfil' },
  { hex: '#f7e7ce', nombre: 'Champán' },
];

export function dressCodeVacio(): DressCode {
  const formal = ESTILOS_VESTIMENTA.find((e) => e.id === 'formal')!;
  return {
    activo: false,
    tipo: formal.id,
    titulo: formal.titulo,
    descripcion: formal.descripcion,
    ellas: formal.ellas,
    ellos: formal.ellos,
    colores: [],
    coloresEvitar: [],
    nota: '',
  };
}

export function esColorClaro(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}

export function iconoEstiloVestimenta(tipo: string | undefined): string {
  return ESTILOS_VESTIMENTA.find((e) => e.id === tipo)?.icono || 'pi-star';
}
