import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Output,
  AfterViewInit,
} from '@angular/core';

/**
 * Directiva que fuerza a iOS y Android a abrir el teclado numérico telefónico
 * en las casillas de InputOtp sin romper el funcionamiento ni las animaciones,
 * y previene la escritura de letras emitiendo una alerta.
 */
@Directive({
  selector: '[appOtpNumerico]',
  standalone: true,
})
export class OtpNumericoDirective implements AfterViewInit {
  private el = inject(ElementRef);
  @Output() caracterInvalido = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.aplicarAtributos();
  }

  @HostListener('focusin')
  onFocus(): void {
    this.aplicarAtributos();
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const teclasEspeciales = [
      'Backspace',
      'Tab',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Enter',
      'Escape',
    ];
    if (teclasEspeciales.includes(event.key) || event.ctrlKey || event.metaKey) {
      return;
    }

    // Si se presiona cualquier tecla que no sea un número 0-9
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.caracterInvalido.emit();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const pegado = event.clipboardData?.getData('text') || '';
    if (pegado && !/^\d+$/.test(pegado)) {
      this.caracterInvalido.emit();
    }
  }

  private aplicarAtributos(): void {
    const inputs = this.el.nativeElement.querySelectorAll('input');
    inputs.forEach((input: HTMLInputElement) => {
      input.setAttribute('type', 'tel');
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9]*');
      input.setAttribute('autocomplete', 'one-time-code');
    });
  }
}
