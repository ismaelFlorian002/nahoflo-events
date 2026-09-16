import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InputOtpModule } from 'primeng/inputotp';
import { Evento } from '../../../../core/models/event.model';
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
  @Input({ required: true }) evento!: Evento;
  @Input() tieneInvitacion: boolean = true;

  @Output() pinValido = new EventEmitter<string>();

  pinIngresado = '';
  errorPin = signal<boolean>(false);
  errorSoloNumeros = signal<boolean>(false);
  private timerAlertaNumeros: any;
  private timerErrorPin: any;

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
    this.errorPin.set(false);
    clearTimeout(this.timerErrorPin);
    if (this.pinIngresado && /\D/.test(this.pinIngresado)) {
      this.mostrarAlertaSoloNumeros();
      this.pinIngresado = this.pinIngresado.replace(/\D/g, '');
    }
    const pinEsperado = this.evento?.pinAnfitrion;
    const longitud = pinEsperado ? pinEsperado.length : 4;
    if (this.pinIngresado && this.pinIngresado.length === longitud) {
      this.verificarPin();
    }
  }

  verificarPin(): void {
    if (!this.evento || !this.evento.id) return;

    if (this.pinIngresado.trim() === this.evento.pinAnfitrion) {
      this.errorPin.set(false);
      clearTimeout(this.timerErrorPin);
      this.pinValido.emit(this.pinIngresado.trim());
    } else {
      this.errorPin.set(true);
      clearTimeout(this.timerErrorPin);
      this.timerErrorPin = setTimeout(() => {
        this.errorPin.set(false);
      }, 3000);

      // Limpia el PIN para que el usuario pueda volver a ingresarlo de inmediato
      setTimeout(() => {
        this.pinIngresado = '';
        const firstInput = document.querySelector<HTMLInputElement>('.pin-otp-contenedor input');
        firstInput?.focus();
      }, 350);
    }
  }
}
