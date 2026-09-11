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
  query,
  where,
  increment,
  arrayUnion,
} from '@angular/fire/firestore';
import { Evento } from '../models/event.model';
import { InvitadoModel } from '../models/invitado.model';
import { ComentarioModel, RecuerdoModel } from '../models/RecuerdoModel';

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

  // Convertimos a Array nativo con Array.from() para soportar FileList y evitar colisiones
  async uploadMultipleImages(files: any, folder: string = 'eventos/galeria'): Promise<string[]> {
    const fileList = Array.from(files || []) as File[];
    if (fileList.length === 0) return [];
    const uploadPromises = fileList.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  // Busca un evento por su URL personalizada (slug) asegurando que esté activo
  async getEventBySlug(slug: string): Promise<Evento | null> {
    const refColeccion = collection(this.firestore, 'eventos');
    const q = query(refColeccion, where('enlace', '==', slug), where('estaActivo', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Evento;
  }

  // Guarda la confirmación en la subcolección 'invitados' del evento
  async confirmarAsistencia(eventoId: string, datosInvitado: InvitadoModel) {
    // Ruta en Firestore: eventos/{eventoId}/invitados
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);

    return addDoc(refSubcoleccion, {
      ...datosInvitado,
      fechaConfirmacion: new Date(),
    });
  }

  // Obtiene la lista completa de confirmaciones (invitados) de un evento
  async getInvitados(eventoId: string): Promise<InvitadoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);
    const snapshot = await getDocs(refSubcoleccion);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as InvitadoModel);
  }

  // Sube la foto del invitado a Storage y guarda su dedicatoria en la subcolección 'recuerdos'
  async guardarRecuerdo(
    eventoId: string,
    archivoFoto: File,
    nombreAutor: string,
    mensaje?: string,
  ): Promise<void> {
    // 1. Sube la foto a la carpeta del álbum en Firebase Storage
    const fotoUrl = await this.uploadImage(archivoFoto, 'eventos/album');

    // 2. Registra el recuerdo en Firestore: eventos/{eventoId}/recuerdos
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    await addDoc(refSubcoleccion, {
      nombreAutor: nombreAutor.trim(),
      mensaje: mensaje?.trim() || '',
      fotoUrl: fotoUrl,
      creadoEn: new Date(),
      estaAprobado: true,
      meGusta: 0,
    });
  }

  // Obtiene todos los recuerdos de los invitados ordenados por los más recientes
  async getRecuerdos(eventoId: string): Promise<RecuerdoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    const snapshot = await getDocs(refSubcoleccion);

    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as RecuerdoModel)
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  }

  // Suma (+1) o resta (-1) un like de forma atómica en Firestore
  async alternarMeGusta(eventoId: string, recuerdoId: string, sumar: boolean): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await updateDoc(docRef, {
      meGusta: increment(sumar ? 1 : -1),
    });
  }

  // Agrega un comentario a la foto en Firebase usando arrayUnion (1 sola escritura, 0 lecturas)
  async agregarComentario(
    eventoId: string,
    recuerdoId: string,
    autor: string,
    texto: string,
  ): Promise<ComentarioModel> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);

    const nuevoComentario: ComentarioModel = {
      id: Date.now().toString(),
      autor: autor.trim(),
      texto: texto.trim(),
      creadoEn: new Date(),
    };

    await updateDoc(docRef, {
      comentarios: arrayUnion(nuevoComentario),
    });

    return nuevoComentario;
  }
}
