import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { doc, getDoc, updateDoc, Firestore } from '@angular/fire/firestore';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { PerfilUsuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private ngZone    = inject(NgZone);

  // Estado reactivo en memoria del perfil
  private _perfil$ = new BehaviorSubject<PerfilUsuario | null>(null);
  readonly perfil$: Observable<PerfilUsuario | null> = this._perfil$.asObservable();

  readonly esAdmin$: Observable<boolean> = this.perfil$.pipe(
    map(p => p?.rol === 'admin' && p.estaActivo === true),
  );

  readonly esPartner$: Observable<boolean> = this.perfil$.pipe(
    map(p => p?.rol === 'partner' && p.estaActivo === true),
  );

  // Promesa para saber cuándo Firebase terminó de cargar la sesión inicial de almacenamiento
  private initPromise: Promise<void>;
  private inicializado = false;

  constructor() {
    this.initPromise = this.inicializarAuth();
  }

  private async inicializarAuth(): Promise<void> {
    try {
      if (typeof this.auth.authStateReady === 'function') {
        await this.auth.authStateReady();
      }
    } catch (e) {
      console.warn('[UsuarioService] authStateReady error:', e);
    }

    const currentUser = this.auth.currentUser;
    if (currentUser && !currentUser.isAnonymous) {
      const perfil = await this.obtenerPerfilPorUid(currentUser.uid);
      this.setPerfil(perfil);
    } else {
      this.setPerfil(null);
    }

    this.inicializado = true;

    // Mantener sincronizado ante cambios futuros de Firebase Auth
    authState(this.auth).subscribe(async (user) => {
      if (!user || user.isAnonymous) {
        if (this._perfil$.value !== null) {
          this.setPerfil(null);
        }
      } else {
        const actual = this._perfil$.value;
        if (!actual || actual.uid !== user.uid) {
          const perfil = await this.obtenerPerfilPorUid(user.uid);
          this.setPerfil(perfil);
        }
      }
    });
  }

  /**
   * Actualiza el perfil de forma inmediata y síncrona dentro de la zona de Angular.
   */
  setPerfil(perfil: PerfilUsuario | null) {
    this.ngZone.run(() => {
      this._perfil$.next(perfil);
    });
  }

  /**
   * Obtiene el valor actual del perfil de manera síncrona.
   */
  getPerfilActual(): PerfilUsuario | null {
    return this._perfil$.value;
  }

  /**
   * Garantiza que el perfil real esté cargado y disponible para Guards y Servicios.
   * Si por condición de carrera no está en memoria pero el usuario está autenticado,
   * lo consulta directamente antes de responder.
   */
  async esperarInicializacion(): Promise<PerfilUsuario | null> {
    if (!this.inicializado) {
      await this.initPromise;
    }

    const currentUser = this.auth.currentUser;
    if (!this._perfil$.value && currentUser && !currentUser.isAnonymous) {
      const perfil = await this.obtenerPerfilPorUid(currentUser.uid);
      if (perfil) {
        this.setPerfil(perfil);
      }
    }

    return this._perfil$.value;
  }

  /**
   * Consulta directa al documento /usuarios/{uid} usando getDoc de @angular/fire/firestore.
   */
  async obtenerPerfilPorUid(uid: string): Promise<PerfilUsuario | null> {
    try {
      const docRef = doc(this.firestore, `usuarios/${uid}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn(`[UsuarioService] No se encontró documento /usuarios/${uid}`);
        return null;
      }

      const perfil = { uid: docSnap.id, ...docSnap.data() } as PerfilUsuario;
      return this.sincronizarCorreo(perfil);
    } catch (error) {
      console.error('[UsuarioService] Error al consultar perfil en Firestore:', error);
      throw error;
    }
  }

  /** Tras confirmar un cambio de correo, Auth ya tiene el nuevo; lo reflejamos en /usuarios. */
  private async sincronizarCorreo(perfil: PerfilUsuario): Promise<PerfilUsuario> {
    const user = this.auth.currentUser;
    if (!user || user.isAnonymous || user.uid !== perfil.uid || !user.email || user.email === perfil.email) {
      return perfil;
    }
    try {
      await updateDoc(doc(this.firestore, `usuarios/${perfil.uid}`), { email: user.email });
      return { ...perfil, email: user.email };
    } catch (error) {
      console.warn('[UsuarioService] No se pudo sincronizar el correo:', error);
      return perfil;
    }
  }

  async cerrarSesionAnonima(): Promise<void> {
    const user = this.auth.currentUser;
    if (user?.isAnonymous) {
      await this.auth.signOut();
    }
  }
}
