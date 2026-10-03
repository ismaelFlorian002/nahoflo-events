import { MesaRegalos } from '../models/event.model';

export interface TiendaCatalogo {
  id: string;
  nombre: string;
}

export const TIENDAS_REGALOS: TiendaCatalogo[] = [
  { id: 'liverpool', nombre: 'Liverpool' },
  { id: 'palacio', nombre: 'El Palacio de Hierro' },
  { id: 'amazon', nombre: 'Amazon' },
  { id: 'sears', nombre: 'Sears' },
  { id: 'costco', nombre: 'Costco' },
  { id: 'walmart', nombre: 'Walmart' },
  { id: 'coppel', nombre: 'Coppel' },
  { id: 'otra', nombre: 'Otra tienda' },
];

export function mesaRegalosVacia(): MesaRegalos {
  return {
    activa: false,
    mensaje: 'Tu presencia es nuestro mejor regalo. Si deseas tener un detalle con nosotros, te compartimos algunas opciones.',
    tiendas: [],
    sobres: {
      activo: false,
      texto: 'Habrá un buzón en la recepción para quienes prefieran regalar en efectivo.',
    },
    transferencia: {
      activa: false,
      titulo: 'Si quieres ayudarnos con nuestra Luna de Miel',
      mensaje: '',
      banco: '',
      titular: '',
      clabe: '',
      cuenta: '',
      tarjeta: '',
      concepto: '',
      whatsappComprobante: '',
    },
  };
}

/** Códigos de banco (primeros 3 dígitos de la CLABE) según el catálogo de Banxico. */
const BANCOS_CLABE: Record<string, string> = {
  '002': 'Banamex',
  '006': 'Bancomext',
  '012': 'BBVA',
  '014': 'Santander',
  '019': 'Banjército',
  '021': 'HSBC',
  '030': 'BanBajío',
  '036': 'Inbursa',
  '042': 'Mifel',
  '044': 'Scotiabank',
  '058': 'Banregio',
  '059': 'Invex',
  '062': 'Afirme',
  '072': 'Banorte',
  '127': 'Banco Azteca',
  '130': 'Compartamos',
  '132': 'Multiva',
  '136': 'Intercam',
  '137': 'BanCoppel',
  '156': 'Sabadell',
  '166': 'Banco del Bienestar',
  '638': 'Nu México',
  '646': 'STP',
  '722': 'Mercado Pago',
};

export function soloDigitos(valor: string | null | undefined): string {
  return (valor || '').replace(/\D/g, '');
}

export function bancoDesdeClabe(clabe: string | null | undefined): string | null {
  const digitos = soloDigitos(clabe);
  return digitos.length >= 3 ? BANCOS_CLABE[digitos.slice(0, 3)] || null : null;
}

/** Valida longitud (18) y dígito verificador de la CLABE (ponderaciones 3, 7, 1). */
export function clabeValida(clabe: string | null | undefined): boolean {
  const digitos = soloDigitos(clabe);
  if (digitos.length !== 18) return false;
  const pesos = [3, 7, 1];
  const suma = digitos
    .slice(0, 17)
    .split('')
    .reduce((acc, d, i) => acc + ((Number(d) * pesos[i % 3]) % 10), 0);
  return (10 - (suma % 10)) % 10 === Number(digitos[17]);
}

/** Agrupa dígitos de 4 en 4 para que sean fáciles de leer. */
export function agruparDigitos(valor: string | null | undefined): string {
  return soloDigitos(valor).replace(/(\d{4})(?=\d)/g, '$1 ');
}
