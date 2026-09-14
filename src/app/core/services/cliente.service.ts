import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  increment,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import { ClienteModel } from '../models/cliente.model';

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private firestore = inject(Firestore);
  private clientesCol = collection(this.firestore, 'clientes');

  /**
   * Obtiene todos los clientes ordenados por fecha de creación más reciente
   */
  async getClientes(): Promise<ClienteModel[]> {
    try {
      const q = query(this.clientesCol, orderBy('creadoEn', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClienteModel[];
    } catch (error) {
      // Fallback si no existe índice o campo de ordenamiento
      const snapshot = await getDocs(this.clientesCol);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClienteModel[];
    }
  }

  /**
   * Registra un nuevo cliente en Firestore y retorna su ID asignado
   */
  async createCliente(cliente: Omit<ClienteModel, 'id'>): Promise<string> {
    const docRef = await addDoc(this.clientesCol, {
      nombreCompleto: cliente.nombreCompleto.trim(),
      telefono: cliente.telefono?.trim() || '',
      email: cliente.email?.trim() || '',
      notas: cliente.notas?.trim() || '',
      totalEventos: cliente.totalEventos || 1,
      creadoEn: cliente.creadoEn || new Date(),
    });
    return docRef.id;
  }

  /**
   * Actualiza datos de un cliente existente
   */
  async updateCliente(id: string, cliente: Partial<ClienteModel>): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await updateDoc(docRef, cliente as any);
  }

  /**
   * Incrementa el contador de eventos de un cliente recurrente
   */
  async incrementarTotalEventos(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await updateDoc(docRef, {
      totalEventos: increment(1),
    });
  }

  /**
   * Elimina un cliente del catálogo
   */
  async deleteCliente(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'clientes', id);
    await deleteDoc(docRef);
  }
}
