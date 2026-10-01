import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';

import { AuthService } from '../../../core/services/auth';
import { UsuarioService } from '../../../core/services/usuario.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private authService    = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private router         = inject(Router);
  private ngZone         = inject(NgZone);

  email        = '';
  password     = '';
  loading      = false;
  errorMessage = '';
  currentYear  = new Date().getFullYear();

  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, llena ambos campos.';
      return;
    }

    this.loading      = true;
    this.errorMessage = '';

    try {
      // 1. Iniciar sesión en Firebase Auth
      const credencial = await this.authService.login(this.email.trim(), this.password);
      const uid = credencial.user.uid;

      // 2. Obtener el perfil directamente
      const perfil = await this.usuarioService.obtenerPerfilPorUid(uid);

      if (!perfil) {
        await this.authService.logout();
        this.errorMessage = 'No se encontró el perfil de usuario asociado a esta cuenta.';
        return;
      }

      if (!perfil.estaActivo) {
        await this.authService.logout();
        this.errorMessage = 'Tu cuenta ha sido desactivada. Contacta al administrador.';
        return;
      }

      // 3. ACTUALIZAR EL ESTADO EN MEMORIA INMEDIATAMENTE
      this.usuarioService.setPerfil(perfil);

      // 4. Redirigir de inmediato dentro de la zona de Angular
      this.ngZone.run(async () => {
        if (perfil.rol === 'admin') {
          await this.router.navigate(['/admin/eventos']);
        } else if (perfil.rol === 'partner') {
          await this.router.navigate(['/partner/eventos']);
        } else {
          await this.authService.logout();
          this.errorMessage = `Rol '${perfil.rol}' no reconocido. Contacta al administrador.`;
        }
      });
    } catch (error: any) {
      console.error('Error durante el inicio de sesión:', error);
      const codigo = error?.code || '';
      if (
        codigo === 'auth/user-not-found' ||
        codigo === 'auth/wrong-password' ||
        codigo === 'auth/invalid-credential'
      ) {
        this.errorMessage = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
      } else if (codigo === 'auth/too-many-requests') {
        this.errorMessage = 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
      } else if (error?.code === 'permission-denied') {
        this.errorMessage = 'Permiso denegado al leer el perfil en Firestore. Revisa las Security Rules.';
      } else {
        this.errorMessage = error?.message || 'Ocurrió un error al iniciar sesión. Intenta de nuevo.';
      }
    } finally {
      this.loading = false;
    }
  }
}
