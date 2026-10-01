import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { doc, getDoc, Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { UsuarioService } from '../services/usuario.service';

/** Prefijo de clave de sessionStorage para la sesión de PIN del Host. */
export const pinSessionKey = (eventoId: string) => `pin_${eventoId}`;

/**
 * Guard para /e/:slug/asistencias/**
 *
 * Flujo de decisión:
 *
 * 1. ¿El usuario tiene sesión Firebase real (no anónima)?
 *    → Deja pasar. AnfitrionAsistenciasComponent desbloquea sin PIN solo si es
 *      Admin o el Partner dueño del evento (puedeAdministrarSinPin); si no, pide PIN.
 *
 * 2. ¿Existe un PIN válido en sessionStorage para este evento?
 *    → Verifica el PIN contra /eventos/{id}/privado/acceso en Firestore.
 *    → Si es correcto: inicia sesión anónima de Firebase y permite acceso.
 *    → Si expiró o cambió: limpia sessionStorage y muestra pantalla de PIN.
 *
 * 3. ¿Ninguno de los anteriores?
 *    → Deja pasar. El componente AnfitrionAsistenciasComponent muestra la
 *      pantalla de PIN internamente (comportamiento actual preservado).
 *      El guard no redirige a /login porque /asistencias es una ruta pública
 *      que se auto-bloquea con su propia pantalla de PIN.
 */
export const pinGuard: CanActivateFn = async (route) => {
  const usuarioService = inject(UsuarioService);
  const firestore      = inject(Firestore);
  const auth           = inject(Auth);
  const router         = inject(Router);

  // Paso 1: ¿Hay un usuario real autenticado (Admin o Partner)?
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    return true;
  }

  // Obtener el slug del árbol de rutas
  const slug = route.pathFromRoot
    .map(r => r.paramMap.get('slug'))
    .find(Boolean);

  if (!slug) return router.createUrlTree(['/']);

  // Paso 2: Buscar PIN en sessionStorage (formato: pin_<eventoId>)
  // Compatible con el formato existente en AnfitrionAsistenciasComponent
  const pinEntry = Object.entries(sessionStorage).find(([key]) => key.startsWith('pin_'));

  if (pinEntry) {
    const [sesionKey, pinGuardado] = pinEntry;
    const eventoId = sesionKey.replace('pin_', '');

    if (pinGuardado && eventoId) {
      try {
        // Verificar el PIN contra el sub-documento privado (Paso 2 - Firestore Rules)
        const privadoRef  = doc(firestore, `eventos/${eventoId}/privado/acceso`);
        const privadoSnap = await getDoc(privadoRef);

        if (privadoSnap.exists() && privadoSnap.data()['pinAnfitrion'] === pinGuardado) {
          // PIN correcto → iniciar sesión anónima para satisfacer las Firestore Rules
          await usuarioService.iniciarSesionAnonimaHost();
          return true; // ✅ Sesión de Host restaurada
        }

        // El PIN en sessionStorage ya no coincide (fue cambiado por el Partner)
        sessionStorage.removeItem(sesionKey);
      } catch {
        // Si Firestore falla (sin conexión), dejar pasar al componente
        // que mostrará la pantalla de PIN o usará el estado cacheado
      }
    }
  }

  // Paso 3: Sin sesión válida → dejar pasar, el componente gestiona la pantalla de PIN
  return true;
};
