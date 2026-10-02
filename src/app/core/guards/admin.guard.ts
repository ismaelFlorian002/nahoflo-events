import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../services/usuario.service';

/**
 * Guard para secciones exclusivas de administrador dentro de /panel.
 *
 * Los demás roles regresan al inicio del panel; si no hay sesión,
 * panelGuard los envía al login.
 */
export const adminGuard: CanActivateFn = async () => {
  const usuarioService = inject(UsuarioService);
  const router         = inject(Router);

  const perfil = await usuarioService.esperarInicializacion();

  if (perfil?.estaActivo && perfil.rol === 'admin') {
    return true;
  }

  return router.createUrlTree(['/panel']);
};
