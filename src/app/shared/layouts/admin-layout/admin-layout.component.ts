import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { User } from '@angular/fire/auth';

// Módulos de PrimeNG
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    ButtonModule,
    SidebarModule,
    MenuModule,
    TooltipModule,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  // Control de estado expandido / minimizado (Escritorio)
  sidebarExpandido = true;

  // Control de menú deslizable en móvil
  sidebarMovilAbierto = false;

  // Datos del usuario logueado
  usuarioActual: User | null = null;
  private userSub?: Subscription;
  private routerSub?: Subscription;

  get saludoUsuario(): string {
    if (!this.usuarioActual) return '¡Bienvenido!';
    const nombre = this.usuarioActual.displayName?.trim();
    if (nombre) {
      const partes = nombre.split(/\s+/);
      const nombreCorto = partes.length > 1 ? `${partes[0]} ${partes[1]}` : partes[0];
      return `¡Hola, ${nombreCorto}!`;
    }
    if (this.usuarioActual.email) {
      const alias = this.usuarioActual.email.split('@')[0].replace(/[0-9_.-]+$/, '');
      const formateado = alias ? alias.charAt(0).toUpperCase() + alias.slice(1) : 'Admin';
      return `¡Hola, ${formateado}!`;
    }
    return '¡Bienvenido!';
  }

  get usuarioEmail(): string {
    return this.usuarioActual?.email || '';
  }

  get inicialesUsuario(): string {
    if (!this.usuarioActual) return 'A';
    if (this.usuarioActual.displayName) {
      const parts = this.usuarioActual.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (this.usuarioActual.email) {
      return this.usuarioActual.email.substring(0, 2).toUpperCase();
    }
    return 'A';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target) return;

    // Si el clic ocurre dentro de un diálogo modal o dropdown overlay, no alteramos el sidebar
    if (
      target.closest('.p-dialog') ||
      target.closest('.p-dynamic-dialog') ||
      target.closest('.p-dialog-mask') ||
      target.closest('.p-dropdown-panel') ||
      target.closest('.p-overlaypanel') ||
      target.closest('.cdk-overlay-container') ||
      target.closest('.cdk-overlay-backdrop')
    ) {
      return;
    }

    const esMovil = window.innerWidth < 768;

    if (esMovil) {
      // En móvil: si está abierto y el clic es fuera del aside y no es el botón hamburguesa, se cierra
      if (this.sidebarMovilAbierto) {
        const aside = this.elementRef.nativeElement.querySelector('aside');
        const botonHamburguesa = this.elementRef.nativeElement.querySelector('#btn-hamburguesa');
        if (aside && !aside.contains(target) && (!botonHamburguesa || !botonHamburguesa.contains(target))) {
          this.sidebarMovilAbierto = false;
          this.cdr.detectChanges();
        }
      }
      return;
    }

    // En escritorio:
    const aside = this.elementRef.nativeElement.querySelector('aside');
    if (!aside) return;

    const clickEnAside = aside.contains(target);

    if (clickEnAside) {
      // Clic dentro del menú: si está minimizado, se maximiza
      if (!this.sidebarExpandido) {
        this.sidebarExpandido = true;
        this.cdr.detectChanges();
      }
    } else {
      // Clic fuera del menú: si está maximizado, se minimiza
      if (this.sidebarExpandido) {
        this.sidebarExpandido = false;
        this.cdr.detectChanges();
      }
    }
  }

  toggleSidebar(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.sidebarExpandido = !this.sidebarExpandido;
    this.cdr.detectChanges();
  }

  expandirSidebar() {
    this.sidebarExpandido = true;
    this.cdr.detectChanges();
  }

  toggleSidebarMovil(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.sidebarMovilAbierto = !this.sidebarMovilAbierto;
    this.cdr.detectChanges();
  }

  cerrarSidebarMovil(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.sidebarMovilAbierto = false;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.userSub = this.authService.user$.subscribe((user) => {
      this.usuarioActual = user;
      this.cdr.detectChanges();
    });

    // Cerrar automáticamente el menú móvil al navegar
    this.routerSub = this.router.events.subscribe(() => {
      if (this.sidebarMovilAbierto) {
        this.sidebarMovilAbierto = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  logout() {
    this.confirmationService.confirm({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas cerrar tu sesión en la plataforma?',
      icon: 'pi pi-power-off text-red-500',
      acceptLabel: 'Sí, cerrar sesión',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        try {
          await this.authService.logout();
          this.messageService.add({
            severity: 'info',
            summary: 'Sesión Finalizada',
            detail: 'Has cerrado sesión exitosamente.',
          });
          this.router.navigate(['/login']);
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        }
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'Permaneces en tu sesión activa.',
        });
      },
    });
  }
}
