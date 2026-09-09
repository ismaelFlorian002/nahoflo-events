import { Injectable, inject } from '@angular/core';
// Importamos getDocs (el comando nativo de Firebase)
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from '@angular/fire/firestore';
import { Evento } from '../models/event.model';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private firestore = inject(Firestore);

  // 1. LEER (A prueba de balas)
  async getEvents(): Promise<Evento[]> {
    const refColeccion = collection(this.firestore, 'eventos');
    const snapshot = await getDocs(refColeccion);

    // Extraemos el ID y los datos de cada documento
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Evento);
  }

  // 2. CREAR
  async createEvent(event: Evento) {
    const refColeccion = collection(this.firestore, 'eventos');
    return addDoc(refColeccion, event);
  }

  // 3. ACTUALIZAR
  async updateEvent(id: string, data: any): Promise<void> {
    const eventDoc = doc(this.firestore, `eventos/${id}`);
    await updateDoc(eventDoc, data);
  }

  // 4. BORRAR
  async deleteEvent(id: string) {
    const docRef = doc(this.firestore, `eventos/${id}`);
    return deleteDoc(docRef);
  }
}
