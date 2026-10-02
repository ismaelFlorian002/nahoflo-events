import { Injectable, inject } from '@angular/core';
import {
  Auth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from '@angular/fire/auth';
import { PartnerService } from './partner.service';
import { UsuarioService } from './usuario.service';

export interface CambiosPerfil {
  displayName: string;
  agenciaTelefono: string;
  agenciaNombre?: string;
}

/**
 * Operaciones que el usuario logueado puede hacer sobre su propia cuenta.
 * Las Security Rules solo permiten escribir displayName, agenciaTelefono,
 * agenciaNombre y email (este último igual a token.email) en el propio documento.
 */
@Injectable({ providedIn: 'root' })
export class PerfilService {
  private auth = inject(Auth);
  private usuarioService = inject(UsuarioService);
  private partnerService = inject(PartnerService);

  private usuarioActual() {
    const user = this.auth.currentUser;
    if (!user || user.isAnonymous || !user.email) {
      throw Object.assign(new Error('No hay una sesión activa.'), { code: 'auth/no-current-user' });
    }
    return user;
  }

  private async reautenticar(passwordActual: string) {
    const user = this.usuarioActual();
    const credencial = EmailAuthProvider.credential(user.email!, passwordActual);
    await reauthenticateWithCredential(user, credencial);
    return user;
  }

  async actualizarMisDatos(cambios: CambiosPerfil): Promise<void> {
    const user = this.usuarioActual();
    const perfil = this.usuarioService.getPerfilActual();
    if (!perfil) throw new Error('No se encontró el perfil.');

    const datos: CambiosPerfil = {
      displayName: cambios.displayName.trim(),
      agenciaTelefono: cambios.agenciaTelefono.trim(),
    };
    if (perfil.rol === 'partner' && cambios.agenciaNombre !== undefined) {
      datos.agenciaNombre = cambios.agenciaNombre.trim();
    }

    // updateUsuario también sincroniza el contacto en los eventos del partner
    await this.partnerService.updateUsuario(user.uid, datos);
    await updateProfile(user, { displayName: datos.displayName });
    this.usuarioService.setPerfil({ ...perfil, ...datos });
  }

  async cambiarPassword(passwordActual: string, passwordNueva: string): Promise<void> {
    const user = await this.reautenticar(passwordActual);
    await updatePassword(user, passwordNueva);
  }

  /** Envía un enlace al correo nuevo; el cambio solo ocurre cuando el usuario lo confirma. */
  async solicitarCambioCorreo(correoNuevo: string, passwordActual: string): Promise<void> {
    const user = await this.reautenticar(passwordActual);
    await verifyBeforeUpdateEmail(user, correoNuevo.trim(), {
      url: `${window.location.origin}/login`,
    });
  }
}
