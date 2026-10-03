import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { UsuarioService } from '../../../core/services/usuario.service';
import { PerfilService } from '../../../core/services/perfil.service';

const PASSWORD_SEGURA = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function validarPasswords(group: AbstractControl): ValidationErrors | null {
  const actual = group.get('actual')?.value;
  const nueva = group.get('nueva')?.value;
  const confirmar = group.get('confirmar')?.value;
  const errores: ValidationErrors = {};
  if (nueva && confirmar && nueva !== confirmar) errores['noCoinciden'] = true;
  if (actual && nueva && actual === nueva) errores['igualAActual'] = true;
  return Object.keys(errores).length ? errores : null;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
  ],
  templateUrl: './perfil.component.html',
  styles: [`
    .perfil-entrada { animation: perfil-entrada 0.35s ease-out both; }
    @keyframes perfil-entrada {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: none; }
    }
  `],
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private usuarioService = inject(UsuarioService);
  private perfilService = inject(PerfilService);
  private messageService = inject(MessageService);

  readonly perfil = toSignal(this.usuarioService.perfil$, { initialValue: null });
  readonly esPartner = computed(() => this.perfil()?.rol === 'partner');
  readonly iniciales = computed(() => {
    const partes = (this.perfil()?.displayName || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].substring(0, 2)).toUpperCase();
  });

  ultimoAcceso = '';
  guardandoDatos = signal(false);
  guardandoPassword = signal(false);
  enviandoCorreo = signal(false);
  mostrarCambioCorreo = signal(false);
  correoPendiente = signal<string | null>(null);

  datosForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    agenciaTelefono: ['', [Validators.minLength(7), Validators.maxLength(20), Validators.pattern(/^[0-9+\s()-]*$/)]],
    agenciaNombre: ['', [Validators.maxLength(80)]],
  });

  passwordForm = this.fb.nonNullable.group(
    {
      actual: ['', Validators.required],
      nueva: ['', [Validators.required, Validators.pattern(PASSWORD_SEGURA)]],
      confirmar: ['', Validators.required],
    },
    { validators: validarPasswords },
  );

  correoForm = this.fb.nonNullable.group({
    nuevo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly emailVerificado = this.auth.currentUser?.emailVerified ?? false;
  readonly etiquetaFuerza = ['Sin definir', 'Débil', 'Aceptable', 'Fuerte'];

  private readonly nuevaPw = toSignal(this.passwordForm.controls.nueva.valueChanges, { initialValue: '' });
  private readonly confirmarPw = toSignal(this.passwordForm.controls.confirmar.valueChanges, { initialValue: '' });

  readonly requisitosPw = computed(() => {
    const nueva = this.nuevaPw() || '';
    const confirmar = this.confirmarPw() || '';
    return [
      { texto: 'Mínimo 8 caracteres', ok: nueva.length >= 8 },
      { texto: 'Al menos una letra', ok: /[A-Za-z]/.test(nueva) },
      { texto: 'Al menos un número', ok: /\d/.test(nueva) },
      { texto: 'Ambas contraseñas coinciden', ok: !!nueva && nueva === confirmar },
    ];
  });

  readonly fuerzaPw = computed(() => {
    const v = this.nuevaPw() || '';
    if (!v) return 0;
    if (!PASSWORD_SEGURA.test(v)) return 1;
    const extra = v.length >= 12 || /[^A-Za-z0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v));
    return extra ? 3 : 2;
  });

  ngOnInit(): void {
    this.cargarDatos();
    const ultimo = this.auth.currentUser?.metadata.lastSignInTime;
    if (ultimo) {
      this.ultimoAcceso = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ultimo));
    }

    const agencia = this.datosForm.controls.agenciaNombre;
    if (this.esPartner()) {
      agencia.addValidators([Validators.required, Validators.minLength(2)]);
      agencia.updateValueAndValidity();
    }
  }

  private cargarDatos(): void {
    const p = this.perfil();
    this.datosForm.reset({
      displayName: p?.displayName || '',
      agenciaTelefono: p?.agenciaTelefono || '',
      agenciaNombre: p?.agenciaNombre || '',
    });
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '—';
    const d = typeof fecha?.toDate === 'function' ? fecha.toDate() : new Date(fecha?.seconds ? fecha.seconds * 1000 : fecha);
    return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(d);
  }

  descartarDatos(): void {
    this.cargarDatos();
  }

  async guardarDatos(): Promise<void> {
    if (this.datosForm.invalid) {
      this.datosForm.markAllAsTouched();
      return;
    }
    if (this.datosForm.pristine) return;

    this.guardandoDatos.set(true);
    try {
      const { displayName, agenciaTelefono, agenciaNombre } = this.datosForm.getRawValue();
      await this.perfilService.actualizarMisDatos({
        displayName,
        agenciaTelefono,
        agenciaNombre: this.esPartner() ? agenciaNombre : undefined,
      });
      this.cargarDatos();
      this.messageService.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Tus datos se guardaron correctamente.' });
    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron guardar tus datos.' });
    } finally {
      this.guardandoDatos.set(false);
    }
  }

  async cambiarPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.guardandoPassword.set(true);
    try {
      const { actual, nueva } = this.passwordForm.getRawValue();
      await this.perfilService.cambiarPassword(actual, nueva);
      this.passwordForm.reset();
      this.messageService.add({ severity: 'success', summary: 'Contraseña actualizada', detail: 'Úsala la próxima vez que inicies sesión.' });
    } catch (error: any) {
      console.error('Error al cambiar la contraseña:', error);
      this.messageService.add({ severity: 'error', summary: 'No se pudo cambiar', detail: this.mensajeError(error?.code) });
    } finally {
      this.guardandoPassword.set(false);
    }
  }

  abrirCambioCorreo(): void {
    this.correoForm.reset();
    this.mostrarCambioCorreo.set(true);
  }

  cancelarCambioCorreo(): void {
    this.correoForm.reset();
    this.mostrarCambioCorreo.set(false);
  }

  async solicitarCambioCorreo(): Promise<void> {
    if (this.correoForm.invalid) {
      this.correoForm.markAllAsTouched();
      return;
    }
    const { nuevo, password } = this.correoForm.getRawValue();
    if (nuevo.trim().toLowerCase() === (this.perfil()?.email || '').toLowerCase()) {
      this.messageService.add({ severity: 'warn', summary: 'Mismo correo', detail: 'Escribe un correo distinto al actual.' });
      return;
    }

    this.enviandoCorreo.set(true);
    try {
      await this.perfilService.solicitarCambioCorreo(nuevo, password);
      this.correoPendiente.set(nuevo.trim());
      this.cancelarCambioCorreo();
    } catch (error: any) {
      console.error('Error al solicitar cambio de correo:', error);
      this.messageService.add({ severity: 'error', summary: 'No se pudo enviar', detail: this.mensajeError(error?.code) });
    } finally {
      this.enviandoCorreo.set(false);
    }
  }

  private mensajeError(codigo?: string): string {
    switch (codigo) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Tu contraseña actual no es correcta.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
      case 'auth/weak-password':
        return 'La contraseña nueva es demasiado débil.';
      case 'auth/requires-recent-login':
        return 'Por seguridad, cierra sesión y vuelve a entrar antes de hacer este cambio.';
      case 'auth/email-already-in-use':
        return 'Ese correo ya está registrado en otra cuenta.';
      case 'auth/invalid-email':
        return 'El correo no es válido.';
      case 'auth/operation-not-allowed':
        return 'El cambio de correo no está habilitado en el proyecto de Firebase.';
      default:
        return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    }
  }
}
