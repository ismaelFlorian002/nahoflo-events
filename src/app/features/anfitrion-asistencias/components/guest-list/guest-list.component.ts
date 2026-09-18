import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

export type GuestStatus = 'pendiente' | 'confirmado' | 'declinado';

export interface GuestListGuest {
  id?: string;
  nombre: string;
  asistira: boolean;
  estado?: GuestStatus;
  pasesConfirmados: number;
  telefono?: string;
  mensaje?: string;
  haIngresado?: boolean;
  pasesIngresados?: number;
}

export interface GuestPassChange {
  guest: GuestListGuest;
  delta: -1 | 1;
}

@Component({
  selector: 'app-guest-list',
  standalone: true,
  imports: [ButtonModule, TableModule, TagModule],
  templateUrl: './guest-list.component.html',
})
export class GuestListComponent {
  readonly guests = input.required<readonly GuestListGuest[]>();
  readonly loading = input<boolean>(false);
  readonly showVipPassActions = input<boolean>(false);
  readonly showInvitationActions = input<boolean>(true);

  readonly viewGuest = output<GuestListGuest>();
  readonly editGuest = output<GuestListGuest>();
  readonly deleteGuest = output<GuestListGuest>();
  readonly sendInvitation = output<GuestListGuest>();
  readonly sendVipPass = output<GuestListGuest>();
  readonly showQrPass = output<GuestListGuest>();
  readonly checkInGuest = output<GuestListGuest>();
  readonly revertCheckInGuest = output<GuestListGuest>();
  readonly changeGuestPasses = output<GuestPassChange>();

  protected readonly hasGuests = computed(() => this.guests().length > 0);
  protected readonly tableRows = computed(() => (this.hasGuests() ? [0] : []));

  protected getStatusLabel(guest: GuestListGuest): string {
    if (guest.estado === 'pendiente') {
      return 'Pendiente';
    }

    return guest.asistira ? 'Asistirá' : 'No asiste';
  }

  protected getStatusSeverity(guest: GuestListGuest): 'success' | 'warning' | 'danger' {
    if (guest.estado === 'pendiente') {
      return 'warning';
    }

    return guest.asistira ? 'success' : 'danger';
  }

  protected canReceivePass(guest: GuestListGuest): boolean {
    return guest.asistira || guest.estado === 'pendiente';
  }

  protected getPassesLabel(guest: GuestListGuest): string {
    const passes = this.canReceivePass(guest) ? guest.pasesConfirmados || 1 : 0;
    return passes === 1 ? '1 pase' : `${passes} pases`;
  }

  protected emitPassChange(guest: GuestListGuest, delta: -1 | 1): void {
    this.changeGuestPasses.emit({ guest, delta });
  }
}
