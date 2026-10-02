import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../services/usuario.service';

/**
 * Guard para rutas /panel/**
 *
 * Permite el acceso a usuarios activos con rol 'admin' o 'partner'.
 * El contenido de cada pantalla se adapta al rol del perfil.
 */
export const panelGuard: CanActivateFn = async () => {
  const usuarioService = inject(UsuarioService);
  const router         = inject(Router);

  const perfil = await usuarioService.esperarInicializacion();

  if (perfil?.estaActivo && (perfil.rol === 'admin' || perfil.rol === 'partner')) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
