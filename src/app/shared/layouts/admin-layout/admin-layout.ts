import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

// Módulos de PrimeNG
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, ButtonModule, SidebarModule, MenuModule],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.scss'],
})
export class AdminLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Opciones del menú lateral
  menuItems: MenuItem[] = [];

  // NUEVO: Variable que controla si el menú está abierto o cerrado
  sidebarVisible = true;
  // NUEVO: Función para alternar el menú
  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  ngOnInit() {
    this.menuItems = [
      {
        label: 'Panel de Control',
        items: [
          { label: 'Resumen', icon: 'pi pi-home', routerLink: '/admin' },
          { label: 'Mis Eventos', icon: 'pi pi-calendar', routerLink: '/admin/eventos' },
        ],
      },
      {
        label: 'Sistema',
        items: [
          {
            label: 'Cerrar Sesión',
            icon: 'pi pi-power-off',
            command: () => this.logout(),
          },
        ],
      },
    ];
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
