import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../services/usuario.service';

/**
 * Guard para la ruta /login.
 *
 * Si el usuario ya está autenticado y tiene perfil activo, lo redirige a su workspace.
 * Si acaba de cerrar sesión, perfil es null inmediatamente y muestra el login sin trabas.
 */
export const redirectIfAuthenticatedGuard: CanActivateFn = async () => {
  const usuarioService = inject(UsuarioService);
  const router         = inject(Router);

  const perfil = await usuarioService.esperarInicializacion();

  // Si no hay perfil, mostrar login
  if (!perfil || !perfil.estaActivo || !perfil.rol) {
    return true;
  }

  // Si ya tiene sesión activa, redirigir
  if (perfil.rol === 'admin')   return router.createUrlTree(['/admin']);
  if (perfil.rol === 'partner') return router.createUrlTree(['/partner']);

  return true;
};
