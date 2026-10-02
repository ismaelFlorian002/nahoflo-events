import { inject, Injectable } from '@angular/core';
import { Auth, signInAnonymously, signOut } from '@angular/fire/auth';
import { deleteDoc, doc, Firestore, getDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

export type ResultadoPin =
  | { ok: true }
  | { ok: false; motivo: 'incorrecto'; intentosRestantes?: number }
  | { ok: false; motivo: 'bloqueado'; minutos: number }
  | { ok: false; motivo: 'no-disponible' | 'dispositivo' | 'conexion' };

/**
 * Acceso del anfitrión por PIN. El PIN se verifica en la Cloud Function
 * `verificarPinAnfitrion`, que registra eventos/{id}/anfitriones/{uid};
 * las reglas de Firestore usan ese registro para autorizar el portal.
 */
@Injectable({ providedIn: 'root' })
export class AccesoAnfitrionService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  async verificarPin(eventoId: string, pin: string): Promise<ResultadoPin> {
    try {
      await this.auth.authStateReady();
      if (!this.auth.currentUser) await signInAnonymously(this.auth);

      const verificar = httpsCallable<{ eventoId: string; pin: string }, { ok: boolean }>(
        this.functions,
        'verificarPinAnfitrion',
      );
      await verificar({ eventoId, pin });
      return { ok: true };
    } catch (error: any) {
      const detalles = error?.details ?? {};
      switch (error?.code) {
        case 'functions/permission-denied':
          if (detalles.intentosRestantes === 0) return { ok: false, motivo: 'bloqueado', minutos: 15 };
          return { ok: false, motivo: 'incorrecto', intentosRestantes: detalles.intentosRestantes };
        case 'functions/resource-exhausted':
          return { ok: false, motivo: 'bloqueado', minutos: detalles.minutos ?? 15 };
        case 'functions/not-found':
        case 'functions/failed-precondition':
          return { ok: false, motivo: 'no-disponible' };
        case 'functions/unauthenticated':
        case 'appCheck/recaptcha-error':
        case 'appCheck/fetch-status-error':
          return { ok: false, motivo: 'dispositivo' };
        default:
          console.error('[AccesoAnfitrion] Error al verificar el PIN:', error);
          return { ok: false, motivo: 'conexion' };
      }
    }
  }

  /** La regla solo permite leer el registro si su pinVersion sigue vigente. */
  async tieneSesionVigente(eventoId: string): Promise<boolean> {
    await this.auth.authStateReady();
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    try {
      const snap = await getDoc(doc(this.firestore, `eventos/${eventoId}/anfitriones/${uid}`));
      return snap.exists();
    } catch {
      return false;
    }
  }

  async cerrarSesion(eventoId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(this.firestore, `eventos/${eventoId}/anfitriones/${user.uid}`));
    } catch (error) {
      console.warn('[AccesoAnfitrion] No se pudo revocar la sesión del anfitrión:', error);
    }
    if (user.isAnonymous) await signOut(this.auth);
  }
}
