import { Injectable, inject } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

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

  private storage = inject(Storage); // <--- NUEVO: Inyectamos el servicio de almacenamiento de Google

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

  // NUEVA FUNCIÓN: Sube una foto a Firebase y nos devuelve la URL
  async uploadImage(file: File, folder: string = 'eventos'): Promise<string> {
    try {
      // 1. Creamos un nombre único usando la fecha actual para que no se sobrescriban
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${folder}/${fileName}`;

      // 2. Apuntamos a ese espacio en la nube
      const storageRef = ref(this.storage, filePath);

      // 3. Subimos el archivo
      await uploadBytes(storageRef, file);

      // 4. Obtenemos el link público para guardarlo en la base de datos
      const publicUrl = await getDownloadURL(storageRef);
      return publicUrl;
    } catch (error) {
      console.error('Error al subir la imagen:', error);
      throw error;
    }
  }
}
