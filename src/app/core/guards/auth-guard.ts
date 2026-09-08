import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Leemos el estado de Firebase una sola vez (take 1)
  return authService.user$.pipe(
    take(1),
    map((user) => {
      if (user) {
        return true; // Tiene credenciales, déjalo pasar
      } else {
        router.navigate(['/login']); // Es un intruso, patéalo a la pantalla de login
        return false;
      }
    }),
  );
};
