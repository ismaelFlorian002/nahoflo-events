import { Component, computed, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Evento, MesaDiseno } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { EventService } from '../../../../core/services/event.service';
import { MesaFormModalComponent } from '../mesa-form-modal/mesa-form-modal.component';
import { MesaDetalleModalComponent } from '../mesa-detalle-modal/mesa-detalle-modal.component';

@Component({
  selector: 'app-croquis-mesas-designer',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './croquis-mesas-designer.component.html',
  styleUrl: './croquis-mesas-designer.component.scss',
})
export class CroquisMesasDesignerComponent implements OnInit {
  @Input({ required: true }) evento!: Evento;
  @Input() invitados: InvitadoModel[] = [];
  @Output() eventoActualizado = new EventEmitter<Evento>();

  private eventService = inject(EventService);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  Math = Math;

  mesas = signal<MesaDiseno[]>([]);
  guardando = signal<boolean>(false);

  ngOnInit(): void {
    if (this.evento.mesasLayout && this.evento.mesasLayout.length > 0) {
      this.mesas.set(this.evento.mesasLayout);
    } else {
      // Intentar autogenerar desde la lista de invitados si ya tienen números de mesa
      this.autogenerarMesasIniciales(false);
    }
  }

  // Métricas Computadas
  totalMesas = computed(() => this.mesas().length);

  totalCapacidad = computed(() =>
    this.mesas().reduce((sum, m) => sum + (Number(m.capacidad) || 0), 0),
  );

  totalAsientosOcupados = computed(() => {
    return this.invitados
      .filter((i) => i.mesa && i.mesa.trim() !== '')
      .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 1), 0);
  });

  invitadosSinMesa = computed(() => {
    return this.invitados.filter((i) => !i.mesa || i.mesa.trim() === '');
  });

  totalAlergias = computed(() => {
    return this.invitados.filter(
      (i) => i.restriccionesAlimentarias && i.restriccionesAlimentarias.trim() !== '',
    ).length;
  });

  mesasConSobrecupo = computed(() => {
    return this.mesas().filter((m) => this.obtenerAsientosOcupadosMesa(m.nombre) > m.capacidad).length;
  });

  obtenerAsientosOcupadosMesa(nombreMesa: string): number {
    return this.invitados
      .filter((i) => i.mesa && i.mesa.trim().toLowerCase() === nombreMesa.trim().toLowerCase())
      .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 1), 0);
  }

  obtenerInvitadosMesa(nombreMesa: string): InvitadoModel[] {
    return this.invitados.filter(
      (i) => i.mesa && i.mesa.trim().toLowerCase() === nombreMesa.trim().toLowerCase(),
    );
  }

  tieneAlergiasMesa(nombreMesa: string): boolean {
    return this.obtenerInvitadosMesa(nombreMesa).some(
      (i) => i.restriccionesAlimentarias && i.restriccionesAlimentarias.trim() !== '',
    );
  }

  // Autogenera estructuras de mesas basándose en los valores `mesa` existentes en la lista de invitados
  autogenerarMesasIniciales(notificar = true): void {
    const nombresExistentes = new Set<string>();
    const mesasActuales = [...this.mesas()];

    mesasActuales.forEach((m) => nombresExistentes.add(m.nombre.trim().toLowerCase()));

    const nombresDesdeInvitados = new Set<string>();
    this.invitados.forEach((i) => {
      if (i.mesa && i.mesa.trim()) {
        nombresDesdeInvitados.add(i.mesa.trim());
      }
    });

    let creadas = 0;
    nombresDesdeInvitados.forEach((nombre) => {
      if (!nombresExistentes.has(nombre.toLowerCase())) {
        const invitadosMesa = this.invitados.filter(
          (i) => i.mesa && i.mesa.trim().toLowerCase() === nombre.toLowerCase(),
        );
        const pasesTotal = invitadosMesa.reduce(
          (sum, i) => sum + (Number(i.pasesConfirmados) || 1),
          0,
        );
        const capacidadSugerida = Math.max(10, Math.ceil(pasesTotal / 2) * 2);

        mesasActuales.push({
          id: 'mesa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          nombre: nombre,
          forma: nombre.toLowerCase().includes('novio') ? 'imperial' : 'redonda',
          capacidad: capacidadSugerida,
        });
        creadas++;
      }
    });

    if (creadas > 0) {
      this.mesas.set(mesasActuales);
      this.guardarMesasLayout(mesasActuales);
      if (notificar) {
        this.messageService.add({
          severity: 'success',
          summary: 'Mesas Generadas',
          detail: `Se crearon ${creadas} mesas automáticamente a partir de los invitados.`,
        });
      }
    } else if (notificar) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin Nuevas Mesas',
        detail: 'Todas las mesas nombradas en la lista de invitados ya están creadas.',
      });
    }
  }

  abrirModalCrearMesa(): void {
    const ref = this.dialogService.open(MesaFormModalComponent, {
      header: 'Crear Nueva Mesa',
      width: '1200px',
      breakpoints: { '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: { cantidadMesas: this.mesas().length },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.guardado && res.mesa) {
        const nuevas = [...this.mesas(), res.mesa];
        this.mesas.set(nuevas);
        this.guardarMesasLayout(nuevas);
        this.messageService.add({
          severity: 'success',
          summary: 'Mesa Creada',
          detail: `La mesa "${res.mesa.nombre}" fue agregada.`,
        });
      }
    });
  }

  abrirModalDetalleMesa(mesa: MesaDiseno): void {
    const ref = this.dialogService.open(MesaDetalleModalComponent, {
      header: `Distribución de ${mesa.nombre}`,
      width: '1200px',
      breakpoints: { '960px': '80vw', '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: {
        mesa,
        invitados: this.invitados,
      },
    });

    ref?.onClose.subscribe(async (res: any) => {
      if (res?.accion === 'editar') {
        this.abrirModalEditarMesa(res.mesa);
      } else if (res?.accion === 'eliminar') {
        this.eliminarMesa(res.mesaId);
      } else if (res?.cambio) {
        // Guardar cambios en asignación de invitados
        await this.persistirAsignacionesInvitados();
      }
    });
  }

  abrirModalEditarMesa(mesa: MesaDiseno): void {
    const ref = this.dialogService.open(MesaFormModalComponent, {
      header: `Editar ${mesa.nombre}`,
      width: '560px',
      breakpoints: { '640px': '94vw' },
      closable: true,
      dismissableMask: true,
      data: { mesa },
    });

    ref?.onClose.subscribe((res: any) => {
      if (res?.guardado && res.mesa) {
        const actualizadas = this.mesas().map((m) => (m.id === res.mesa.id ? res.mesa : m));
        this.mesas.set(actualizadas);
        this.guardarMesasLayout(actualizadas);
        this.messageService.add({
          severity: 'success',
          summary: 'Mesa Actualizada',
          detail: `Se guardaron los datos de ${res.mesa.nombre}.`,
        });
      }
    });
  }

  async persistirAsignacionesInvitados(): Promise<void> {
    const evId = this.evento.id;
    if (!evId) return;

    this.guardando.set(true);
    try {
      const promesas = this.invitados.map((i) =>
        this.eventService.asignarMesaInvitado(evId, i.id!, i.mesa || ''),
      );
      await Promise.all(promesas);
      this.messageService.add({
        severity: 'success',
        summary: 'Asignaciones Guardadas',
        detail: 'Los cambios en la distribución de invitados fueron guardados en Firebase.',
      });
    } catch (e) {
      console.error('Error al guardar asignación de mesas:', e);
    } finally {
      this.guardando.set(false);
    }
  }

  eliminarMesa(mesaId: string): void {
    const mesa = this.mesas().find((m) => m.id === mesaId);
    if (!mesa) return;

    this.confirmationService.confirm({
      header: 'Eliminar Mesa',
      message: `¿Deseas eliminar "${mesa.nombre}"? Los invitados sentados en esta mesa quedarán marcados como "Sin Mesa".`,
      icon: 'pi pi-trash text-red-500',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        // Desasignar mesa a los invitados
        this.invitados.forEach((i) => {
          if (i.mesa && i.mesa.trim().toLowerCase() === mesa.nombre.trim().toLowerCase()) {
            i.mesa = '';
          }
        });
        const filtradas = this.mesas().filter((m) => m.id !== mesaId);
        this.mesas.set(filtradas);
        await this.guardarMesasLayout(filtradas);
        await this.persistirAsignacionesInvitados();
        this.messageService.add({
          severity: 'info',
          summary: 'Mesa Eliminada',
          detail: `La mesa ${mesa.nombre} fue eliminada.`,
        });
      },
    });
  }

  async guardarMesasLayout(mesas: MesaDiseno[]): Promise<void> {
    if (!this.evento.id) return;
    try {
      await this.eventService.actualizarMesasLayout(this.evento.id, mesas);
      this.eventoActualizado.emit({ ...this.evento, mesasLayout: mesas });
    } catch (e) {
      console.error('Error guardando croquis de mesas:', e);
    }
  }

  asignarMesaRapida(invitado: InvitadoModel, mesaNombre: string): void {
    invitado.mesa = mesaNombre;
    this.persistirAsignacionesInvitados();
  }
}
