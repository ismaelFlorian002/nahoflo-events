import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Firestore,
} from '@angular/fire/firestore';
import { initializeApp, deleteApp } from '@angular/fire/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';
import { UsuarioModel, RolUsuario } from '../models/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class PartnerService {
  private firestore = inject(Firestore);

  /**
   * Obtiene todos los usuarios del sistema (Admins y Partners).
   */
  async getUsuarios(): Promise<UsuarioModel[]> {
    try {
      const colRef = collection(this.firestore, 'usuarios');
      const snapshot = await getDocs(colRef);

      const lista = snapshot.docs.map(
        (d) => ({ uid: d.id, ...d.data() } as UsuarioModel),
      );

      return lista.sort((a, b) => {
        const timeA = a.creadoEn ? new Date(a.creadoEn as any).getTime() : 0;
        const timeB = b.creadoEn ? new Date(b.creadoEn as any).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('[PartnerService] Error al obtener usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene únicamente los usuarios con rol 'partner' (Wedding Planners).
   */
  async getPartners(): Promise<UsuarioModel[]> {
    try {
      const colRef = collection(this.firestore, 'usuarios');
      const q = query(colRef, where('rol', '==', 'partner'));
      const snapshot = await getDocs(q);

      const lista = snapshot.docs.map(
        (d) => ({ uid: d.id, ...d.data() } as UsuarioModel),
      );

      return lista.sort((a, b) => {
        const timeA = a.creadoEn ? new Date(a.creadoEn as any).getTime() : 0;
        const timeB = b.creadoEn ? new Date(b.creadoEn as any).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('[PartnerService] Error al obtener partners:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario (Admin o Partner) creando su cuenta en Firebase Auth
   * mediante una app secundaria de Firebase para no desloguear al Admin actual.
   * Luego escribe el documento correspondiente en /usuarios/{uid}.
   */
  async createUsuario(data: {
    email: string;
    password?: string;
    displayName: string;
    rol: RolUsuario;
    agenciaNombre?: string;
    agenciaTelefono?: string;
  }): Promise<string> {
    const appSecundariaNombre = `secondary-user-app-${Date.now()}`;
    const secondaryApp = initializeApp(environment.firebase, appSecundariaNombre);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const passwordFinal = data.password?.trim() || 'Nahoflo2026*';
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email.trim(),
        passwordFinal,
      );
      const uid = cred.user.uid;

      if (data.displayName?.trim()) {
        await updateProfile(cred.user, {
          displayName: data.displayName.trim(),
        });
      }

      // Guardar el documento en /usuarios usando la sesión del Admin
      const docRef = doc(this.firestore, `usuarios/${uid}`);
      await setDoc(docRef, {
        uid: uid,
        email: data.email.trim(),
        displayName: data.displayName.trim(),
        rol: data.rol,
        agenciaNombre: data.rol === 'partner' ? (data.agenciaNombre?.trim() || '') : '',
        agenciaTelefono: data.agenciaTelefono?.trim() || '',
        estaActivo: true,
        creadoEn: serverTimestamp(),
      });

      return uid;
    } catch (error) {
      console.error('[PartnerService] Error al crear usuario:', error);
      throw error;
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  /**
   * Alias de conveniencia para compatibilidad.
   */
  async createPartner(data: {
    email: string;
    password?: string;
    displayName: string;
    agenciaNombre?: string;
    agenciaTelefono?: string;
  }): Promise<string> {
    return this.createUsuario({ ...data, rol: 'partner' });
  }

  /**
   * Actualiza los datos y/o rol de un usuario existente.
   */
  async updateUsuario(
    uid: string,
    data: {
      displayName?: string;
      rol?: RolUsuario;
      agenciaNombre?: string;
      agenciaTelefono?: string;
    },
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, `usuarios/${uid}`);
      await updateDoc(docRef, {
        ...data,
      });
    } catch (error) {
      console.error('[PartnerService] Error al actualizar usuario:', error);
      throw error;
    }

    if (data.rol !== 'admin' && (data.agenciaTelefono !== undefined || data.agenciaNombre !== undefined)) {
      await this.sincronizarContactoEnEventos(uid, data);
    }
  }

  private async sincronizarContactoEnEventos(
    uid: string,
    data: { displayName?: string; agenciaNombre?: string; agenciaTelefono?: string },
  ): Promise<void> {
    try {
      const snapshot = await getDocs(query(collection(this.firestore, 'eventos'), where('ownerId', '==', uid)));
      const eventosPartner = snapshot.docs.filter((d) => d.data()['esDirecto'] !== true);
      if (!eventosPartner.length) return;

      const contacto: Record<string, string | null> = {};
      if (data.agenciaNombre !== undefined || data.displayName !== undefined) {
        contacto['contactoPartnerNombre'] = data.agenciaNombre?.trim() || data.displayName?.trim() || null;
      }
      if (data.agenciaTelefono !== undefined) {
        contacto['contactoPartnerTelefono'] = data.agenciaTelefono.trim() || null;
      }

      for (let i = 0; i < eventosPartner.length; i += 450) {
        const batch = writeBatch(this.firestore);
        eventosPartner.slice(i, i + 450).forEach((d) => batch.update(d.ref, contacto));
        await batch.commit();
      }
    } catch (error) {
      console.error('[PartnerService] Error al sincronizar contacto en eventos:', error);
    }
  }

  /**
   * Copia el contacto de cada Partner a sus eventos que no lo tengan o lo tengan desactualizado.
   * Requiere sesión de Admin (lectura de todos los eventos). Devuelve cuántos eventos se actualizaron.
   */
  async respaldarContactoEnEventos(usuarios: UsuarioModel[]): Promise<number> {
    const partners = new Map(usuarios.filter((u) => u.rol === 'partner').map((u) => [u.uid, u]));
    if (!partners.size) return 0;

    const snapshot = await getDocs(collection(this.firestore, 'eventos'));
    const pendientes = snapshot.docs.flatMap((d) => {
      const ev = d.data();
      const partner = partners.get(ev['ownerId']);
      if (!partner || ev['esDirecto'] === true) return [];
      const contacto = {
        contactoPartnerNombre: partner.agenciaNombre?.trim() || partner.displayName?.trim() || null,
        contactoPartnerTelefono: partner.agenciaTelefono?.trim() || null,
      };
      const igual =
        ev['contactoPartnerNombre'] === contacto.contactoPartnerNombre &&
        ev['contactoPartnerTelefono'] === contacto.contactoPartnerTelefono;
      return igual ? [] : [{ ref: d.ref, contacto }];
    });

    for (let i = 0; i < pendientes.length; i += 450) {
      const batch = writeBatch(this.firestore);
      pendientes.slice(i, i + 450).forEach(({ ref, contacto }) => batch.update(ref, contacto));
      await batch.commit();
    }
    return pendientes.length;
  }

  async updatePartner(
    uid: string,
    data: {
      displayName?: string;
      agenciaNombre?: string;
      agenciaTelefono?: string;
    },
  ): Promise<void> {
    return this.updateUsuario(uid, data);
  }

  /**
   * Activa o desactiva la cuenta de un usuario.
   */
  async toggleEstadoUsuario(uid: string, estaActivo: boolean): Promise<void> {
    try {
      const docRef = doc(this.firestore, `usuarios/${uid}`);
      await updateDoc(docRef, { estaActivo });
    } catch (error) {
      console.error('[PartnerService] Error al cambiar estado del usuario:', error);
      throw error;
    }
  }

  async toggleEstadoPartner(uid: string, estaActivo: boolean): Promise<void> {
    return this.toggleEstadoUsuario(uid, estaActivo);
  }
}
