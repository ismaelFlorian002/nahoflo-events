import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Módulos de PrimeNG necesarios para esta pantalla
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../core/services/auth';

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
  // Inyección de dependencias
  private authService = inject(AuthService);
  private router = inject(Router);

  // Estado del formulario
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  currentYear = new Date().getFullYear();

  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, llena ambos campos.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.email, this.password);
      // Si entra correctamente, lo redirigimos al panel de control
      this.router.navigate(['/admin']);
    } catch (error) {
      this.errorMessage = 'Credenciales incorrectas o usuario no encontrado.';
    } finally {
      this.loading = false;
    }
  }
}
