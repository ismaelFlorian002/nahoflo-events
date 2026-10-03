import { Directive, ElementRef, OnDestroy, OnInit, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type EfectoRevelar = 'subir' | 'zoom' | 'izquierda' | 'derecha' | 'desenfoque';

/**
 * Agrega la clase `revelado` cuando el elemento entra al viewport.
 * Las animaciones viven en el CSS del componente que la usa (`.revelar--{efecto}` y `.revelado`).
 */
@Directive({
  selector: '[appRevelar]',
  standalone: true,
})
export class RevelarDirective implements OnInit, OnDestroy {
  readonly efecto = input<EfectoRevelar | ''>('subir', { alias: 'appRevelar' });
  readonly retraso = input(0, { alias: 'revelarRetraso' });

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const nodo = this.el.nativeElement;
    nodo.classList.add('revelar', `revelar--${this.efecto() || 'subir'}`);
    if (this.retraso()) nodo.style.transitionDelay = `${this.retraso()}ms`;

    if (!isPlatformBrowser(this.platformId) || !('IntersectionObserver' in window)) {
      nodo.classList.add('revelado');
      return;
    }

    this.observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          nodo.classList.add('revelado');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    this.observer.observe(nodo);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
