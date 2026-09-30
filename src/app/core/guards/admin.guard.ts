import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../services/usuario.service';

/**
 * Guard para rutas /admin/**
 *
 * Permite el acceso SOLO a usuarios con rol 'admin' y estaActivo=true.
 * Resuelve de forma asíncrona esperando a que Firebase y UsuarioService
 * tengan el perfil real en memoria, sin lecturas desfasadas de observables viejos.
 */
export const adminGuard: CanActivateFn = async () => {
  const usuarioService = inject(UsuarioService);
  const router         = inject(Router);

  const perfil = await usuarioService.esperarInicializacion();

  if (!perfil) {
    return router.createUrlTree(['/login']);
  }
  if (perfil.rol === 'partner' && perfil.estaActivo) {
    return router.createUrlTree(['/partner']);
  }
  if (perfil.rol === 'admin' && perfil.estaActivo) {
    return true; // ✅ Admin válido
  }

  return router.createUrlTree(['/login']);
};
