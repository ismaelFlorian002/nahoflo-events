export interface Evento {
  id?: string;
  enlace: string; // Ej: "boda-ana-luis"
  titulo: string; // Ej: "Enlace Matrimonial Ana y Luis"
  fecha: string; // Fecha del evento
  tipo: string; // Ej: "Boda", "XV Años", "Bautizo"
  estaActivo: boolean; // Interruptor para apagar la invitación
}
