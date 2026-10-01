import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { DrawerModule } from 'primeng/drawer';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PORTAL_PATHS, PortalSection } from '../../portal-sections';
export type { PortalSection } from '../../portal-sections';

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
  imports: [NgTemplateOutlet, TooltipModule, DrawerModule, RouterLink, RouterLinkActive],
  templateUrl: './portal-navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './portal-navigation.component.scss',
  host: { '(document:click)': 'closeOnOutsideClick($event)' },
})
export class PortalNavigationComponent {
  readonly paths = PORTAL_PATHS;
  readonly items = input.required<PortalNavigationItem[]>();
  readonly active = input.required<PortalSection>();
  readonly brandLogoUrl = input<string | null | undefined>(undefined);
  readonly brandName = input<string>('NahoFlo Creative Studio');
  readonly exitLabel = input<string>('');
  readonly exitIcon = input<string>('pi pi-power-off');
  readonly sectionSelected = output<PortalSection>();
  readonly exit = output<void>();
  drawerVisible = false;
  collapsed = false;

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

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.collapsed = !this.collapsed;
  }

  expandOnAsideClick(event: MouseEvent): void {
    if (!this.collapsed) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.nav-item')) return;
    this.collapsed = false;
  }

  onExit(event: MouseEvent): void {
    event.stopPropagation();
    this.drawerVisible = false;
    this.exit.emit();
  }

  select(section: PortalSection): void {
    this.drawerVisible = false;
    this.sectionSelected.emit(section);
  }
}
