import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SidebarModule } from 'primeng/sidebar';

export type PortalSection =
  | 'resumen'
  | 'invitados'
  | 'croquis'
  | 'whatsapp'
  | 'recepcion'
  | 'minutario'
  | 'presupuesto'
  | 'proveedores'
  | 'checklist'
  | 'album';

export interface PortalNavigationItem {
  id: PortalSection;
  label: string;
  icon: string;
  group: 'Evento' | 'Invitados' | 'Organización' | 'Recuerdos';
  badge?: string;
}

@Component({
  selector: 'app-portal-navigation',
  standalone: true,
  imports: [NgTemplateOutlet, ButtonModule, TooltipModule, SidebarModule],
  templateUrl: './portal-navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './portal-navigation.component.scss',
  host: { '(document:click)': 'closeOnOutsideClick($event)' },
})
export class PortalNavigationComponent {
  readonly items = input.required<PortalNavigationItem[]>();
  readonly active = input.required<PortalSection>();
  readonly brandLogoUrl = input<string | null | undefined>(undefined);
  readonly brandName = input<string>('NahoFlo Creative Studio');
  readonly brandSlogan = input<string>('CreativeStudio');
  readonly sectionSelected = output<PortalSection>();
  drawerVisible = false;
  collapsed = true;

  private readonly desktopMenu = viewChild<ElementRef<HTMLElement>>('desktopMenu');
  private readonly desktopToggle = viewChild<ElementRef<HTMLButtonElement>>('desktopToggle');

  closeOnOutsideClick(event: MouseEvent): void {
    if (this.collapsed) return;
    const path = event.composedPath();
    const menu = this.desktopMenu()?.nativeElement;
    const toggle = this.desktopToggle()?.nativeElement;
    if (menu && !path.includes(menu) && (!toggle || !path.includes(toggle))) {
      this.collapsed = true;
    }
  }

  readonly activeItem = computed(() => this.items().find((item) => item.id === this.active()));
  readonly groups = computed(() => {
    const names: PortalNavigationItem['group'][] = [
      'Evento',
      'Invitados',
      'Organización',
      'Recuerdos',
    ];
    return names
      .map((label) => ({ label, items: this.items().filter((item) => item.group === label) }))
      .filter((group) => group.items.length > 0);
  });

  select(section: PortalSection): void {
    this.drawerVisible = false;
    this.sectionSelected.emit(section);
  }
}
