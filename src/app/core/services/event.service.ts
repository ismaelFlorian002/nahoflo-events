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

// --- UTILIDADES DE DEDUPLICACIÓN INTELIGENTE (TOKEN MATCHING) ---
export function normalizarTextoInvitado(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarTelefonoInvitado(telefono: string): string {
  const digitos = (telefono || '').replace(/\D/g, '');
  return digitos.length >= 10 ? digitos.slice(-10) : digitos;
}

const STOPWORDS_NOMBRES = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
  'familia', 'fam', 'sr', 'sra', 'sres', 'srta', 'lic', 'ing', 'dr', 'dra',
  'tio', 'tia', 'primo', 'prima', 'sobrino', 'sobrina', 'amigo', 'amiga'
]);

/**
 * Determina si dos nombres representan a la misma persona o familia.
 * Utiliza Token Subset Matching: si las palabras clave del nombre corto
 * (ej. "yesenia mota") están presentes en el nombre largo (ej. "yesenia mota martinez").
 */
export function coincidenNombresInvitados(nombreA: string, nombreB: string): boolean {
  const normA = normalizarTextoInvitado(nombreA);
  const normB = normalizarTextoInvitado(nombreB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const tokensA = normA.split(' ').filter((w) => w.length >= 2 && !STOPWORDS_NOMBRES.has(w));
  const tokensB = normB.split(' ').filter((w) => w.length >= 2 && !STOPWORDS_NOMBRES.has(w));

  if (tokensA.length === 0 || tokensB.length === 0) {
    return normA === normB;
  }

  const [corto, largo] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  // Caso 1: Al menos 2 palabras clave significativas coincidentes (ej. Nombre + Apellido)
  if (corto.length >= 2) {
    const todosEnLargo = corto.every((token) => largo.includes(token));
    if (todosEnLargo) return true;
  }

  // Caso 2: Familias (ej. "Familia Mota" vs "Familia Mota Martinez")
  const esFamA = normA.includes('familia') || normA.includes('fam');
  const esFamB = normB.includes('familia') || normB.includes('fam');
  if (esFamA && esFamB && corto.length >= 1) {
    const todosEnLargo = corto.every((token) => largo.includes(token));
    if (todosEnLargo) return true;
  }

  return false;
}

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
  // Guarda o actualiza la confirmación en la subcolección 'invitados' del evento
  // Incluye deduplicación inteligente: si ya existe por ID, teléfono o nombre,
  // actualiza el registro existente en vez de duplicarlo.
  async confirmarAsistencia(
    eventoId: string,
    datosInvitado: InvitadoModel,
    invitadoId?: string
  ): Promise<{ id: string } & Partial<InvitadoModel>> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);

    // 1. Si se provee un ID explícito (ej. enlace con ?pase=ID)
    if (invitadoId) {
      const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
      const payload: Partial<InvitadoModel> = {
        asistira: datosInvitado.asistira,
        estado: datosInvitado.estado || (datosInvitado.asistira ? 'confirmado' : 'declinado'),
        pasesConfirmados: datosInvitado.pasesConfirmados,
        telefono: datosInvitado.telefono?.trim() || '',
        mensaje: datosInvitado.mensaje?.trim() || '',
        fechaConfirmacion: new Date(),
      };
      await updateDoc(refDoc, payload);
      return { id: invitadoId, ...datosInvitado, ...payload };
    }

    // 2. Si no viene ID, consultamos los invitados existentes para evitar duplicidad
    const snapshot = await getDocs(refSubcoleccion);
    const listaExistente = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as InvitadoModel[];

    const telInput = normalizarTelefonoInvitado(datosInvitado.telefono || '');
    const nomInput = (datosInvitado.nombre || '').trim();

    // Buscar coincidencia:
    // A) Primero por teléfono (si tiene al menos 7 dígitos válidos)
    let encontrado: InvitadoModel | undefined = undefined;
    if (telInput.length >= 7) {
      encontrado = listaExistente.find((inv) => {
        const telExistente = normalizarTelefonoInvitado(inv.telefono || '');
        return telExistente.length >= 7 && telExistente === telInput;
      });
    }

    // B) Si no hubo coincidencia por teléfono, buscar por Token Matching Inteligente (nombre + apellidos)
    if (!encontrado && nomInput.length >= 2) {
      encontrado = listaExistente.find((inv) => {
        return coincidenNombresInvitados(inv.nombre || '', nomInput);
      });
    }

    // 3. Si encontramos el registro previo (ej. anfitrión lo precargó en 'pendiente')
    if (encontrado && encontrado.id) {
      const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${encontrado.id}`);

      // Preservamos el nombre más completo y detallado entre ambos
      const nombreFinal = nomInput.length > (encontrado.nombre?.trim().length || 0)
        ? nomInput
        : encontrado.nombre;

      const payload: Partial<InvitadoModel> = {
        nombre: nombreFinal,
        asistira: datosInvitado.asistira,
        estado: datosInvitado.estado || (datosInvitado.asistira ? 'confirmado' : 'declinado'),
        pasesConfirmados: datosInvitado.pasesConfirmados || encontrado.pasesConfirmados || 1,
        telefono: datosInvitado.telefono?.trim() || encontrado.telefono || '',
        mensaje: datosInvitado.mensaje?.trim() || encontrado.mensaje || '',
        fechaConfirmacion: new Date(),
      };
      await updateDoc(refDoc, payload);
      return { id: encontrado.id, ...encontrado, ...payload };
    }

    // 4. Si no existía coincidencia previa, creamos un nuevo registro en Firestore
    const nuevoDocRef = await addDoc(refSubcoleccion, {
      ...datosInvitado,
      haIngresado: false,
      pasesIngresados: 0,
      fechaConfirmacion: new Date(),
    });

    return { id: nuevoDocRef.id, ...datosInvitado };
  }

  // Registra un nuevo invitado manualmente desde el portal del anfitrión
  async agregarInvitado(eventoId: string, datosInvitado: Omit<InvitadoModel, 'id'>) {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);

    return addDoc(refSubcoleccion, {
      ...datosInvitado,
      haIngresado: false,
      pasesIngresados: 0,
      fechaConfirmacion: new Date(),
    });
  }

  // Obtiene la lista completa de confirmaciones (invitados) de un evento
  async getInvitados(eventoId: string): Promise<InvitadoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);
    const snapshot = await getDocs(refSubcoleccion);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as InvitadoModel);
  }

  // Registra el acceso presencial (Check-in) del invitado en la puerta
  async registrarCheckIn(
    eventoId: string,
    invitadoId: string,
    pasesIngresados: number
  ): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, {
      haIngresado: true,
      horaIngreso: new Date(),
      pasesIngresados,
    });
  }

  // Permite revertir el check-in en caso de error del personal de recepción
  async revertirCheckIn(eventoId: string, invitadoId: string): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, {
      haIngresado: false,
      horaIngreso: null,
      pasesIngresados: 0,
    });
  }

  // Permite al anfitrión ajustar el número de pases asignados a un invitado
  async actualizarPasesInvitado(
    eventoId: string,
    invitadoId: string,
    pasesConfirmados: number,
  ): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { pasesConfirmados });
  }

  // Permite al anfitrión actualizar datos completos del invitado (nombre, teléfono, asistencia, pases, mensaje)
  async actualizarInvitado(
    eventoId: string,
    invitadoId: string,
    datos: Partial<InvitadoModel>,
  ): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { ...datos });
  }

  // Permite al anfitrión eliminar un registro de invitado
  async eliminarInvitado(eventoId: string, invitadoId: string): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await deleteDoc(refDoc);
  }

  // Permite fusionar dos registros de invitados (ej. si uno se registró con apodo y otro con nombre formal)
  async fusionarInvitados(
    eventoId: string,
    invitadoConservarId: string,
    invitadoEliminarId: string,
    datosFusionados?: Partial<InvitadoModel>
  ): Promise<void> {
    const refDocConservar = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoConservarId}`);
    const refDocEliminar = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoEliminarId}`);

    if (datosFusionados) {
      await updateDoc(refDocConservar, datosFusionados);
    }
    await deleteDoc(refDocEliminar);
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

  // Elimina una publicación/recuerdo del álbum colaborativo
  async eliminarRecuerdo(eventoId: string, recuerdoId: string): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await deleteDoc(docRef);
  }
}
