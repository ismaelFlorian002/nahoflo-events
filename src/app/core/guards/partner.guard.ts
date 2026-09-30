import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../services/usuario.service';

/**
 * Guard para rutas /partner/**
 *
 * Permite el acceso a usuarios con rol 'partner' Y a 'admin'.
 */
export const partnerGuard: CanActivateFn = async () => {
  const usuarioService = inject(UsuarioService);
  const router         = inject(Router);

  const perfil = await usuarioService.esperarInicializacion();

  if (!perfil) {
    return router.createUrlTree(['/login']);
  }
  if ((perfil.rol === 'partner' || perfil.rol === 'admin') && perfil.estaActivo) {
    return true; // ✅ Acceso permitido
  }

  return router.createUrlTree(['/login']);
};
