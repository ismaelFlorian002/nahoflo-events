import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';

// Importamos getDocs (el comando nativo de Firebase)
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
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
  // Sube una foto a Firebase Storage con identificador único a prueba de colisiones
  async uploadImage(file: File, folder: string = 'eventos'): Promise<string> {
    try {
      // 1. Generamos un sufijo aleatorio y limpiamos caracteres especiales del nombre
      const aleatorio = Math.random().toString(36).substring(2, 8);
      const nombreLimpio = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${aleatorio}_${nombreLimpio}`;
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

  // Sube N fotos del invitado a Storage en paralelo y guarda la publicación del carrusel en Firestore
  // Sube N fotos del invitado a Storage de forma secuencial y guarda el carrusel en Firestore
  async guardarRecuerdo(
    eventoId: string,
    archivosFotos: File[],
    nombreAutor: string,
    mensaje?: string,
  ): Promise<void> {
    // 1. Subir fotos una a una para evitar colisiones y no saturar el ancho de banda del celular
    const urls: string[] = [];
    for (const foto of archivosFotos) {
      const url = await this.uploadImage(foto, 'eventos/album');
      urls.push(url);
    }

    // 2. Registra la publicación con su arreglo de fotos en Firestore
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    await addDoc(refSubcoleccion, {
      nombreAutor: nombreAutor.trim(),
      mensaje: mensaje?.trim() || '',
      fotoUrl: urls[0] || '', // Foto de portada (retrocompatibilidad)
      fotosUrls: urls, // Carrusel completo
      creadoEn: new Date(),
      estaAprobado: true,
      meGusta: 0,
      comentarios: [],
    });
  }

  // Obtiene los recuerdos asegurando que fotosUrls siempre exista para el carrusel
  async getRecuerdos(eventoId: string): Promise<RecuerdoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    const snapshot = await getDocs(refSubcoleccion);

    return snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as RecuerdoModel;
        // Retrocompatibilidad: si es un recuerdo previo con fotoUrl única, lo convertimos a arreglo
        const fotosUrls = data.fotosUrls || (data.fotoUrl ? [data.fotoUrl] : []);
        return { id: docSnap.id, ...data, fotosUrls } as RecuerdoModel;
      })
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

  // Actualiza la lista completa de comentarios (incluyendo respuestas anidadas y likes de comentarios)
  async actualizarComentariosRecuerdo(
    eventoId: string,
    recuerdoId: string,
    comentarios: ComentarioModel[],
  ): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await updateDoc(docRef, { comentarios });
  }
}
