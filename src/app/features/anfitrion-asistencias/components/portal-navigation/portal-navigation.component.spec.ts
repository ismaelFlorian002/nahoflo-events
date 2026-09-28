import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  PortalNavigationComponent,
  PortalNavigationItem,
  PortalSection,
} from './portal-navigation.component';

describe('PortalNavigationComponent', () => {
  const items: PortalNavigationItem[] = [
    { id: 'resumen', label: 'Resumen', icon: 'pi pi-chart-pie', group: 'Evento' },
    {
      id: 'recepcion',
      label: 'Recepcion',
      icon: 'pi pi-qrcode',
      group: 'Invitados',
      badge: '2/24',
    },
    { id: 'album', label: 'Album', icon: 'pi pi-camera', group: 'Recuerdos', badge: '5' },
  ];

  async function setup(active: PortalSection = 'resumen') {
    await TestBed.configureTestingModule({
      imports: [PortalNavigationComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    const fixture = TestBed.createComponent(PortalNavigationComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
    return fixture;
  }

  it('emits the original section id when a desktop option is clicked', async () => {
    const fixture = await setup();
    const selected: PortalSection[] = [];
    fixture.componentInstance.sectionSelected.subscribe((value) => selected.push(value));
    const buttons = fixture.nativeElement.querySelectorAll('nav button');
    buttons[1].click();
    expect(selected).toEqual(['recepcion']);
    expect(buttons[1].textContent).toContain('2/24');
  });

  it('keeps the active selection accessible when collapsed and closes the mobile drawer', async () => {
    const fixture = await setup('album');
    const component = fixture.componentInstance;
    fixture.nativeElement.querySelector('.desktop-toggle').click();
    fixture.detectChanges();
    expect(component.collapsed).toBe(true);
    const active = fixture.nativeElement.querySelector('nav [aria-current="page"]');
    expect(active.getAttribute('aria-label')).toBe('Album: 5');
    const selected: PortalSection[] = [];
    component.sectionSelected.subscribe((value) => selected.push(value));
    component.drawerVisible = true;
    active.click();
    expect(selected).toEqual(['album']);
    expect(component.drawerVisible).toBe(false);
  });

  it('removes unavailable entries from both navigation presentations', async () => {
    const fixture = await setup();
    fixture.componentRef.setInput('items', [items[0]]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('nav button').length).toBe(1);
    expect(
      fixture.componentInstance
        .groups()
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(['resumen']);
  });

  it('closes on an outside click and reopens without cancelling the toggle click', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    fixture.nativeElement.querySelector('.sidebar-brand').click();
    expect(component.collapsed).toBe(false);
    document.body.click();
    expect(component.collapsed).toBe(true);
    fixture.nativeElement.querySelector('.desktop-toggle .p-button-icon').click();
    expect(component.collapsed).toBe(false);
  });
});
