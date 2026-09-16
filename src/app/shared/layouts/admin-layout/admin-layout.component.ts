import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterModule } from '@angular/router';

// Módulos de PrimeNG
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ButtonModule, SidebarModule, MenuModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
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
          { label: 'Eventos', icon: 'pi pi-calendar', routerLink: '/admin' },
          { label: 'Clientes', icon: 'pi pi-users', routerLink: '/admin/clientes' },
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
