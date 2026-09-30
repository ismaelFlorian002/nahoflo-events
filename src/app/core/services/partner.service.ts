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
