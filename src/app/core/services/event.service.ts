import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

import { Evento, ItemMinutario, ItemPresupuesto, MesaDiseno, ProveedorEvento, TareaPlaneacion } from '../models/event.model';
import { InvitadoModel } from '../models/invitado.model';
import { ComentarioModel, RecuerdoModel } from '../models/RecuerdoModel';
import { UsuarioService } from './usuario.service';

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
  private firestore      = inject(Firestore);
  private storage        = inject(Storage);
  private auth           = inject(Auth);
  private usuarioService = inject(UsuarioService);

  /**
   * Resuelve el perfil asegurando que la sesión esté cargada.
   */
  private async getPerfil() {
    return this.usuarioService.esperarInicializacion();
  }

  // ─── 1. LEER ──────────────────────────────────────────────────────────────
  /**
   * Devuelve eventos filtrados por rol y vista:
   * - Partner → solo los eventos donde ownerId === su uid.
   * - Admin en modo 'directos' (por defecto) → solo los eventos directos de NahoFlo (sin ownerId o ownerId === admin.uid).
   * - Admin en modo 'todos' → todos los eventos de la plataforma.
   */
  async getEvents(vistaAdmin: 'directos' | 'todos' = 'directos'): Promise<Evento[]> {
    const perfil         = await this.getPerfil();
    const currentUser    = this.auth.currentUser;
    const refColeccion   = collection(this.firestore, 'eventos');

    const esPartner = perfil?.rol === 'partner' || (currentUser && perfil?.rol !== 'admin');
    if (esPartner) {
      const partnerUid = perfil?.uid || currentUser?.uid;
      // Partner: filtra estrictamente por su ownerId
      const q = query(refColeccion, where('ownerId', '==', partnerUid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento);
    }

    // Modo Administrador
    // 1. Obtenemos los UIDs de los partners registrados para aislar con precisión
    const usuariosCol = collection(this.firestore, 'usuarios');
    const qPartners = query(usuariosCol, where('rol', '==', 'partner'));
    const snapPartners = await getDocs(qPartners);
    const partnerUids = new Set(snapPartners.docs.map(d => d.id));

    // 2. Obtenemos todos los eventos
    const snapshot = await getDocs(refColeccion);
    const todos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Evento);

    if (vistaAdmin === 'directos') {
      // Eventos directos de NahoFlo Studio (Opción A):
      // Incluye todos los eventos que NO pertenecen a un partner registrado
      return todos.filter((e) => !e.ownerId || !partnerUids.has(e.ownerId) || e.esDirecto);
    }

    // Eventos de agencias: SOLO eventos que pertenecen a un partner registrado
    return todos.filter((e) => e.ownerId && partnerUids.has(e.ownerId));
  }

  // ─── 2. CREAR ─────────────────────────────────────────────────────────────
  /**
   * Crea un nuevo evento inyectando automáticamente:
   * - ownerId: uid del Partner o del Admin que lo crea.
   * - creadoPorUid / creadoPorNombre: trazabilidad de qué usuario del equipo lo dio de alta.
   * - esDirecto: flag para identificar eventos del estudio.
   * - creadoEn / actualizadoEn: timestamps de servidor.
   * - urlPublica: igual al slug `enlace` para nuevos eventos.
   */
  async createEvent(event: Evento) {
    const perfil       = await this.getPerfil();
    const currentUser  = this.auth.currentUser;
    const refColeccion = collection(this.firestore, 'eventos');

    const esPartner = perfil?.rol === 'partner' || (currentUser && perfil?.rol !== 'admin');
    const ownerId = esPartner
      ? (perfil?.uid || currentUser?.uid || null)
      : (event.ownerId ?? perfil?.uid ?? currentUser?.uid ?? null);

    const creadoPorNombre =
      perfil?.displayName ||
      currentUser?.displayName ||
      (esPartner ? 'Partner' : 'Administrador');

    const payload: any = {
      ...event,
      ownerId:         ownerId,
      creadoPorUid:    perfil?.uid || currentUser?.uid || null,
      creadoPorNombre: creadoPorNombre,
      esDirecto:       !esPartner,
      ...(esPartner && {
        contactoPartnerNombre:   perfil?.agenciaNombre || perfil?.displayName || null,
        contactoPartnerTelefono: perfil?.agenciaTelefono || null,
      }),
      urlPublica:      event.urlPublica ?? event.enlace ?? '',
      creadoEn:        serverTimestamp(),
      actualizadoEn:   serverTimestamp(),
    };

    return addDoc(refColeccion, payload);
  }

  // ─── 3. ACTUALIZAR ────────────────────────────────────────────────────────
  async updateEvent(id: string, data: any): Promise<void> {
    const eventDoc = doc(this.firestore, `eventos/${id}`);
    await updateDoc(eventDoc, { ...data, actualizadoEn: serverTimestamp() });
  }

  // ─── PIN DEL ANFITRIÓN (eventos/{id}/privado/acceso, solo staff) ─────────
  async getPinAnfitrion(eventoId: string): Promise<string | null> {
    const snap = await getDoc(doc(this.firestore, `eventos/${eventoId}/privado/acceso`));
    return (snap.get('pinAnfitrion') as string | undefined) ?? null;
  }

  /**
   * Guarda el PIN fuera del documento público. Si cambia, sube pinVersion
   * y las sesiones de anfitrión abiertas con el PIN anterior pierden acceso.
   */
  async guardarPinAnfitrion(eventoId: string, pin: string): Promise<void> {
    const accesoRef = doc(this.firestore, `eventos/${eventoId}/privado/acceso`);
    const actual    = await getDoc(accesoRef);
    const versionActual = (actual.get('pinVersion') as number | undefined) ?? 0;

    if (!actual.exists() || actual.get('pinAnfitrion') !== pin) {
      await setDoc(accesoRef, {
        pinAnfitrion:  pin,
        pinVersion:    versionActual + 1,
        actualizadoEn: serverTimestamp(),
      });
    }
    await updateDoc(doc(this.firestore, `eventos/${eventoId}`), {
      pinAnfitrion: deleteField(),
      pinLongitud:  pin.length,
    });
  }

  // Actualiza el minutario / cronograma técnico de un evento
  async actualizarMinutario(eventoId: string, minutario: ItemMinutario[]): Promise<void> {
    const eventDoc = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(eventDoc, { minutario, actualizadoEn: serverTimestamp() });
  }

  // ─── 4. BORRAR ────────────────────────────────────────────────────────────
  async deleteEvent(id: string) {
    const docRef = doc(this.firestore, `eventos/${id}`);
    return deleteDoc(docRef);
  }

  // ─── STORAGE ──────────────────────────────────────────────────────────────
  // Sube una foto a Firebase Storage con identificador único a prueba de colisiones
  async uploadImage(file: File, folder: string = 'eventos'): Promise<string> {
    try {
      const aleatorio   = Math.random().toString(36).substring(2, 8);
      const nombreLimpio = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName    = `${Date.now()}_${aleatorio}_${nombreLimpio}`;
      const filePath    = `${folder}/${fileName}`;
      const storageRef  = ref(this.storage, filePath);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error al subir la imagen:', error);
      throw error;
    }
  }

  async uploadMultipleImages(files: any, folder: string = 'eventos/galeria'): Promise<string[]> {
    const fileList = Array.from(files || []) as File[];
    if (fileList.length === 0) return [];
    return Promise.all(fileList.map((file) => this.uploadImage(file, folder)));
  }

  // ─── BÚSQUEDA POR SLUG ───────────────────────────────────────────────────
  // Busca un evento por su URL personalizada (slug) asegurando que esté activo.
  // Esta consulta es pública (invitación web / portal host) → no filtra por ownerId.
  async getEventBySlug(slug: string): Promise<Evento | null> {
    const refColeccion = collection(this.firestore, 'eventos');
    const q            = query(refColeccion, where('enlace', '==', slug), where('estaActivo', '==', true));
    const snapshot     = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Evento;
  }

  /**
   * Obtiene todos los eventos asociados a un cliente por su ID, teléfono o nombre.
   * Reutiliza getEvents() para que el filtro de rol se aplique automáticamente.
   */
  async getEventsByCliente(clienteId?: string, telefono?: string, clienteNombre?: string): Promise<Evento[]> {
    try {
      if (!clienteId && !telefono && !clienteNombre) return [];
      const todos = await this.getEvents();

      const telLimpio = telefono ? String(telefono).replace(/\D/g, '') : '';
      const nomLimpio = clienteNombre ? clienteNombre.trim().toLowerCase() : '';

      return todos.filter((e) => {
        if (clienteId && e.clienteId === clienteId) return true;
        if (telLimpio && telLimpio.length >= 7 && e.contactoTelefono) {
          const eTel = String(e.contactoTelefono).replace(/\D/g, '');
          if (eTel.length >= 7 && (eTel.includes(telLimpio) || telLimpio.includes(eTel))) return true;
        }
        if (nomLimpio && e.contactoNombre) {
          const eNom = String(e.contactoNombre).trim().toLowerCase();
          if (eNom && (eNom === nomLimpio || eNom.includes(nomLimpio) || nomLimpio.includes(eNom))) return true;
        }
        return false;
      });
    } catch (error) {
      console.error('Error en getEventsByCliente:', error);
      return [];
    }
  }

  // Guarda o actualiza la confirmación en la subcolección 'invitados' del evento.
  // Incluye deduplicación inteligente.
  async confirmarAsistencia(
    eventoId: string,
    datosInvitado: InvitadoModel,
    invitadoId?: string
  ): Promise<{ id: string } & Partial<InvitadoModel>> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);

    if (invitadoId) {
      const refDoc  = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
      const payload: Partial<InvitadoModel> = {
        asistira:          datosInvitado.asistira,
        estado:            datosInvitado.estado || (datosInvitado.asistira ? 'confirmado' : 'declinado'),
        pasesConfirmados:  datosInvitado.pasesConfirmados,
        telefono:          datosInvitado.telefono?.trim() || '',
        mensaje:           datosInvitado.mensaje?.trim() || '',
        fechaConfirmacion: new Date(),
      };
      await updateDoc(refDoc, payload);
      return { id: invitadoId, ...datosInvitado, ...payload };
    }

    const snapshot      = await getDocs(refSubcoleccion);
    const listaExistente = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InvitadoModel[];

    const telInput = normalizarTelefonoInvitado(datosInvitado.telefono || '');
    const nomInput = (datosInvitado.nombre || '').trim();

    let encontrado: InvitadoModel | undefined = undefined;
    if (telInput.length >= 7) {
      encontrado = listaExistente.find((inv) => {
        const telExistente = normalizarTelefonoInvitado(inv.telefono || '');
        return telExistente.length >= 7 && telExistente === telInput;
      });
    }
    if (!encontrado && nomInput.length >= 2) {
      encontrado = listaExistente.find((inv) => coincidenNombresInvitados(inv.nombre || '', nomInput));
    }

    if (encontrado && encontrado.id) {
      const refDoc      = doc(this.firestore, `eventos/${eventoId}/invitados/${encontrado.id}`);
      const nombreFinal = nomInput.length > (encontrado.nombre?.trim().length || 0) ? nomInput : encontrado.nombre;
      const payload: Partial<InvitadoModel> = {
        nombre:            nombreFinal,
        asistira:          datosInvitado.asistira,
        estado:            datosInvitado.estado || (datosInvitado.asistira ? 'confirmado' : 'declinado'),
        pasesConfirmados:  datosInvitado.pasesConfirmados || encontrado.pasesConfirmados || 1,
        telefono:          datosInvitado.telefono?.trim() || encontrado.telefono || '',
        mensaje:           datosInvitado.mensaje?.trim() || encontrado.mensaje || '',
        fechaConfirmacion: new Date(),
      };
      await updateDoc(refDoc, payload);
      return { id: encontrado.id, ...encontrado, ...payload };
    }

    const nuevoDocRef = await addDoc(refSubcoleccion, {
      ...datosInvitado,
      haIngresado:       false,
      pasesIngresados:   0,
      fechaConfirmacion: new Date(),
    });
    return { id: nuevoDocRef.id, ...datosInvitado };
  }

  async agregarInvitado(eventoId: string, datosInvitado: Omit<InvitadoModel, 'id'>) {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);
    return addDoc(refSubcoleccion, {
      ...datosInvitado,
      haIngresado:       false,
      pasesIngresados:   0,
      fechaConfirmacion: new Date(),
    });
  }

  async getInvitados(eventoId: string): Promise<InvitadoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/invitados`);
    const snapshot        = await getDocs(refSubcoleccion);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as InvitadoModel);
  }

  async registrarCheckIn(eventoId: string, invitadoId: string, pasesIngresados: number): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { haIngresado: true, horaIngreso: new Date(), pasesIngresados });
  }

  async revertirCheckIn(eventoId: string, invitadoId: string): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { haIngresado: false, horaIngreso: null, pasesIngresados: 0 });
  }

  async actualizarPasesInvitado(eventoId: string, invitadoId: string, pasesConfirmados: number): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { pasesConfirmados });
  }

  async actualizarInvitado(eventoId: string, invitadoId: string, datos: Partial<InvitadoModel>): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(refDoc, { ...datos });
  }

  async eliminarInvitado(eventoId: string, invitadoId: string): Promise<void> {
    const refDoc = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await deleteDoc(refDoc);
  }

  async fusionarInvitados(
    eventoId: string,
    invitadoConservarId: string,
    invitadoEliminarId: string,
    datosFusionados?: Partial<InvitadoModel>
  ): Promise<void> {
    const refDocConservar = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoConservarId}`);
    const refDocEliminar  = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoEliminarId}`);
    if (datosFusionados) await updateDoc(refDocConservar, datosFusionados);
    await deleteDoc(refDocEliminar);
  }

  async guardarRecuerdo(eventoId: string, archivosFotos: File[], nombreAutor: string, mensaje?: string): Promise<void> {
    const urls: string[] = [];
    for (const foto of archivosFotos) {
      urls.push(await this.uploadImage(foto, 'eventos/album'));
    }
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    await addDoc(refSubcoleccion, {
      nombreAutor:  nombreAutor.trim(),
      mensaje:      mensaje?.trim() || '',
      fotoUrl:      urls[0] || '',
      fotosUrls:    urls,
      creadoEn:     new Date(),
      estaAprobado: true,
      meGusta:      0,
      comentarios:  [],
    });
  }

  async getRecuerdos(eventoId: string): Promise<RecuerdoModel[]> {
    const refSubcoleccion = collection(this.firestore, `eventos/${eventoId}/recuerdos`);
    const snapshot        = await getDocs(refSubcoleccion);
    return snapshot.docs
      .map((docSnap) => {
        const data      = docSnap.data() as RecuerdoModel;
        const fotosUrls = data.fotosUrls || (data.fotoUrl ? [data.fotoUrl] : []);
        return { id: docSnap.id, ...data, fotosUrls } as RecuerdoModel;
      })
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  }

  async alternarMeGusta(eventoId: string, recuerdoId: string, sumar: boolean): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await updateDoc(docRef, { meGusta: increment(sumar ? 1 : -1) });
  }

  async agregarComentario(eventoId: string, recuerdoId: string, autor: string, texto: string): Promise<ComentarioModel> {
    const docRef           = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    const nuevoComentario: ComentarioModel = {
      id:       Date.now().toString(),
      autor:    autor.trim(),
      texto:    texto.trim(),
      creadoEn: new Date(),
    };
    await updateDoc(docRef, { comentarios: arrayUnion(nuevoComentario) });
    return nuevoComentario;
  }

  async actualizarComentariosRecuerdo(eventoId: string, recuerdoId: string, comentarios: ComentarioModel[]): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await updateDoc(docRef, { comentarios });
  }

  async eliminarRecuerdo(eventoId: string, recuerdoId: string): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/recuerdos/${recuerdoId}`);
    await deleteDoc(docRef);
  }

  async actualizarPresupuesto(eventoId: string, presupuesto: ItemPresupuesto[]): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(docRef, { presupuesto, actualizadoEn: serverTimestamp() });
  }

  async actualizarProveedores(eventoId: string, proveedores: ProveedorEvento[]): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(docRef, { proveedores, actualizadoEn: serverTimestamp() });
  }

  async actualizarChecklist(eventoId: string, checklist: TareaPlaneacion[]): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(docRef, { checklist, actualizadoEn: serverTimestamp() });
  }

  async actualizarDatosAgencia(
    eventoId: string,
    datosAgencia: {
      agenciaNombre?: string;
      agenciaLogoUrl?: string;
      agenciaTelefono?: string;
      agenciaNotas?: string;
    },
  ): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(docRef, { ...datosAgencia, actualizadoEn: serverTimestamp() });
  }

  async actualizarMesasLayout(eventoId: string, mesasLayout: MesaDiseno[]): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}`);
    await updateDoc(docRef, { mesasLayout, actualizadoEn: serverTimestamp() });
  }

  async asignarMesaInvitado(eventoId: string, invitadoId: string, mesa: string): Promise<void> {
    const docRef = doc(this.firestore, `eventos/${eventoId}/invitados/${invitadoId}`);
    await updateDoc(docRef, { mesa });
  }
}
