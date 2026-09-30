import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ClienteModel } from '../models/cliente.model';
import { UsuarioService } from './usuario.service';

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private firestore      = inject(Firestore);
  private auth           = inject(Auth);
  private clientesCol    = collection(this.firestore, 'clientes');
  private usuarioService = inject(UsuarioService);

  /**
   * Resuelve el perfil asegurando que la sesión esté cargada.
   */
  private async getPerfil() {
    return this.usuarioService.esperarInicializacion();
  }

  /**
   * Obtiene clientes filtrados:
   * - Partner: estrictamente sus clientes (partnerId === su uid).
   * - Admin en modo 'directos' (por defecto): solo los clientes directos de NahoFlo (partnerId === admin.uid o null).
   * - Admin en modo 'todos': cartera global de toda la plataforma.
   */
  async getClientes(vistaAdmin: 'directos' | 'todos' = 'directos'): Promise<ClienteModel[]> {
    const perfil      = await this.getPerfil();
    const currentUser = this.auth.currentUser;

    const esPartner = perfil?.rol === 'partner' || (currentUser && perfil?.rol !== 'admin');

    if (esPartner) {
      const partnerUid = perfil?.uid || currentUser?.uid;
      const q = query(this.clientesCol, where('partnerId', '==', partnerUid));
      const snapshot = await getDocs(q);
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ClienteModel[];
      return this.ordenarPorFechaDesc(lista);
    }

    // Modo Administrador
    // 1. Obtenemos los UIDs de los partners registrados para aislar con precisión
    const usuariosCol = collection(this.firestore, 'usuarios');
    const qPartners = query(usuariosCol, where('rol', '==', 'partner'));
    const snapPartners = await getDocs(qPartners);
    const partnerUids = new Set(snapPartners.docs.map(d => d.id));

    // 2. Obtenemos todos los clientes
    const snapshot = await getDocs(this.clientesCol);
    const todos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ClienteModel[];

    if (vistaAdmin === 'directos') {
      // Clientes directos de NahoFlo Studio (Opción A):
      // Aquellos sin partnerId, o cuyo partnerId no pertenece a un partner registrado
      const directos = todos.filter((c) => !c.partnerId || !partnerUids.has(c.partnerId) || c.esDirecto);
      return this.ordenarPorFechaDesc(directos);
    }

    // Cartera de agencias: SOLO clientes que pertenecen a un partner registrado
    const deAgencias = todos.filter((c) => c.partnerId && partnerUids.has(c.partnerId));
    return this.ordenarPorFechaDesc(deAgencias);
  }

  /**
   * Registra un nuevo cliente asociando automáticamente el partnerId
   * del usuario que lo registra (Admin o Partner), y guardando datos de trazabilidad.
   */
  async createCliente(cliente: Omit<ClienteModel, 'id'>): Promise<string> {
    const perfil      = await this.getPerfil();
    const currentUser = this.auth.currentUser;

    const esPartner = perfil?.rol === 'partner' || (currentUser && perfil?.rol !== 'admin');
    const partnerId = esPartner
      ? (perfil?.uid || currentUser?.uid || null)
      : (cliente.partnerId ?? perfil?.uid ?? currentUser?.uid ?? null);

    const creadoPorNombre =
      perfil?.displayName ||
      currentUser?.displayName ||
      (esPartner ? 'Partner' : 'Administrador');

    const docRef = await addDoc(this.clientesCol, {
      nombreCompleto:  cliente.nombreCompleto.trim(),
      telefono:        cliente.telefono?.trim() || '',
      email:           cliente.email?.trim() || '',
      notas:           cliente.notas?.trim() || '',
      totalEventos:    cliente.totalEventos || 1,
      partnerId:       partnerId,
      creadoPorUid:    perfil?.uid || currentUser?.uid || null,
      creadoPorNombre: creadoPorNombre,
      esDirecto:       !esPartner,
      creadoEn:        serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Actualiza datos de un cliente existente.
   */
  async updateCliente(id: string, cliente: Partial<ClienteModel>): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await updateDoc(docRef, cliente as any);
  }

  /**
   * Incrementa el contador de eventos de un cliente recurrente.
   */
  async incrementarTotalEventos(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await updateDoc(docRef, { totalEventos: increment(1) });
  }

  /**
   * Elimina un cliente del catálogo.
   */
  async deleteCliente(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await deleteDoc(docRef);
  }

  private ordenarPorFechaDesc(lista: ClienteModel[]): ClienteModel[] {
    return lista.sort((a, b) => {
      const timeA = a.creadoEn ? new Date(a.creadoEn as any).getTime() : 0;
      const timeB = b.creadoEn ? new Date(b.creadoEn as any).getTime() : 0;
      return timeB - timeA;
    });
  }
}
