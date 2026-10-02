import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  AfterViewInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InputOtpModule } from 'primeng/inputotp';
import { Evento } from '../../../../core/models/event.model';
import { AccesoAnfitrionService } from '../../../../core/services/acceso-anfitrion.service';
import { OtpNumericoDirective } from '../../directives/otp-numerico.directive';

@Component({
  selector: 'app-pin-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    InputOtpModule,
    OtpNumericoDirective,
  ],
  templateUrl: './pin-login.component.html',
  styleUrl: '../../anfitrion-asistencias.component.scss',
})
export class PinLoginComponent implements AfterViewInit {
  private accesoAnfitrion = inject(AccesoAnfitrionService);

  @Input({ required: true }) evento!: Evento;
  @Input() tieneInvitacion: boolean = true;

  @Output() pinValido = new EventEmitter<void>();

  pinIngresado = '';
  verificando = signal<boolean>(false);
  errorPin = signal<string | null>(null);
  errorSoloNumeros = signal<boolean>(false);
  private timerAlertaNumeros: any;

  get longitudPin(): number {
    return this.evento?.pinLongitud || this.evento?.pinAnfitrion?.length || 4;
  }

  ngAfterViewInit(): void {
    this.activarTecladoNumericoMovil();
  }

  // Fuerza a los navegadores móviles (iOS y Android) a abrir el teclado numérico grande
  activarTecladoNumericoMovil(): void {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.pin-otp-contenedor input');
      inputs.forEach((input) => {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
        input.setAttribute('type', 'tel');
      });
    }, 150);
  }

  // Muestra alerta temporal cuando se intenta teclear o pegar texto
  mostrarAlertaSoloNumeros(): void {
    this.errorSoloNumeros.set(true);
    clearTimeout(this.timerAlertaNumeros);
    this.timerAlertaNumeros = setTimeout(() => {
      this.errorSoloNumeros.set(false);
    }, 2800);
  }

  // Se dispara en cada pulsación del InputOtp
  onPinChange(): void {
    if (this.pinIngresado) this.errorPin.set(null);
    if (this.pinIngresado && /\D/.test(this.pinIngresado)) {
      this.mostrarAlertaSoloNumeros();
      this.pinIngresado = this.pinIngresado.replace(/\D/g, '');
    }
    if (this.pinIngresado?.length === this.longitudPin) {
      void this.verificarPin();
    }
  }

  async verificarPin(): Promise<void> {
    const pin = this.pinIngresado.trim();
    if (!this.evento?.id || this.verificando() || pin.length !== this.longitudPin) return;

    this.verificando.set(true);
    this.errorPin.set(null);
    const resultado = await this.accesoAnfitrion.verificarPin(this.evento.id, pin);

    if (resultado.ok) {
      this.verificando.set(false);
      this.pinValido.emit();
      return;
    }

    this.pinIngresado = '';
    this.verificando.set(false);

    switch (resultado.motivo) {
      case 'incorrecto':
        this.errorPin.set(
          resultado.intentosRestantes && resultado.intentosRestantes <= 3
            ? `PIN incorrecto. Te quedan ${resultado.intentosRestantes} ${resultado.intentosRestantes === 1 ? 'intento' : 'intentos'}.`
            : 'PIN incorrecto. Intenta de nuevo.',
        );
        break;
      case 'bloqueado':
        this.errorPin.set(
          `Demasiados intentos. Espera ${resultado.minutos} ${resultado.minutos === 1 ? 'minuto' : 'minutos'} para volver a intentar.`,
        );
        break;
      case 'no-disponible':
        this.errorPin.set('Este portal no está disponible. Contacta a tu organizador.');
        break;
      case 'dispositivo':
        this.errorPin.set('No pudimos verificar tu dispositivo. Recarga la página e intenta de nuevo.');
        break;
      default:
        this.errorPin.set('No pudimos conectar. Revisa tu internet e intenta de nuevo.');
    }

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('.pin-otp-contenedor input')?.focus();
    }, 50);
  }
}
