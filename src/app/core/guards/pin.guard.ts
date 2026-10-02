import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Auth } from '@angular/fire/auth';

/**
 * Guard para /e/:slug/asistencias/**
 *
 * Espera a que Firebase restaure la sesión guardada (staff o anfitrión anónimo)
 * antes de mostrar el portal. AnfitrionAsistenciasComponent decide si desbloquea:
 * staff con permisos sin PIN, o anfitrión con registro vigente en
 * eventos/{id}/anfitriones/{uid}; si no, muestra la pantalla de PIN, que se
 * verifica en la Cloud Function `verificarPinAnfitrion`.
 */
export const pinGuard: CanActivateFn = async () => {
  await inject(Auth).authStateReady();
  return true;
};
