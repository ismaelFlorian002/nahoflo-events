import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { Evento } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { PdfReportService } from '../../services/pdf-report.service';

@Component({
  selector: 'app-guest-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    OverlayPanelModule,
    MenuModule,
  ],
  templateUrl: './guest-table.component.html',
  styleUrl: '../../anfitrion-asistencias.component.scss',
})
export class GuestTableComponent {
  private pdfReportService = inject(PdfReportService);

  // Inputs
  evento = input<Evento | null>(null);
  invitados = input<InvitadoModel[]>([]);
  cargando = input<boolean>(false);
  tieneInvitacion = input<boolean>(true);
  totalConfirmados = input<number>(0);
  totalPendientesConfirmacion = input<number>(0);
  totalCancelados = input<number>(0);

  // Outputs para modales y mutaciones coordinadas con el padre
  abrirDetalle = output<InvitadoModel>();
  abrirEditar = output<InvitadoModel>();
  crearInvitado = output<void>();
  compartir = output<void>();
  abrirQr = output<InvitadoModel>();
  cambiarPases = output<{ invitado: InvitadoModel; delta: number }>();
  enviarInvitacionWa = output<InvitadoModel>();
  enviarPaseWa = output<InvitadoModel>();

  // Búsqueda en tiempo real por texto
  terminoBusqueda = signal<string>('');

  // Filtros de asistencia
  filtroRespuesta = signal<'todos' | 'asistira' | 'pendiente' | 'no_asiste'>('todos');

  // Menús desplegables responsivos (PrimeNG Menu)
  menuExportItems: MenuItem[] = [
    {
      label: 'Descargar Excel (.xlsx)',
      icon: 'pi pi-file-excel',
      command: () => this.exportarExcel(),
    },
    {
      label: 'Descargar Reporte PDF',
      icon: 'pi pi-file-pdf',
      command: () => this.exportarPdf(),
    },
  ];

  menuInvitadoItems: MenuItem[] = [];

  // Métricas y etiquetas para el botón con icono de filtro PrimeNG
  labelFiltroActivo = computed(() => {
    switch (this.filtroRespuesta()) {
      case 'asistira':
        return 'Confirmados';
      case 'pendiente':
        return 'Pendientes';
      case 'no_asiste':
        return 'Declinados';
      default:
        return 'Todos';
    }
  });

  conteoFiltroActivo = computed(() => {
    switch (this.filtroRespuesta()) {
      case 'asistira':
        return String(this.totalConfirmados());
      case 'pendiente':
        return String(this.totalPendientesConfirmacion());
      case 'no_asiste':
        return String(this.totalCancelados());
      default:
        return String(this.invitados().length);
    }
  });

  // Lista reactiva filtrada según estado y texto de búsqueda
  invitadosFiltrados = computed(() => {
    let lista = this.invitados();
    const filtro = this.filtroRespuesta();
    if (filtro === 'asistira') {
      lista = lista.filter((i) => (i.estado ? i.estado === 'confirmado' : i.asistira));
    } else if (filtro === 'pendiente') {
      lista = lista.filter((i) => i.estado === 'pendiente');
    } else if (filtro === 'no_asiste') {
      lista = lista.filter((i) => (i.estado ? i.estado === 'declinado' : !i.asistira));
    }

    const query = this.terminoBusqueda().trim().toLowerCase();
    if (query) {
      lista = lista.filter(
        (i) =>
          (i.nombre || '').toLowerCase().includes(query) ||
          (i.telefono || '').toLowerCase().includes(query) ||
          (i.mensaje || '').toLowerCase().includes(query),
      );
    }

    return lista;
  });

  seleccionarFiltro(
    filtro: 'todos' | 'asistira' | 'pendiente' | 'no_asiste',
    table: Table,
    op?: any,
  ): void {
    this.filtroRespuesta.set(filtro);
    table.reset();
    op?.hide();
  }

  // Despliega el menú contextual con las acciones del invitado en móviles y tablets
  abrirMenuAcciones(event: Event, invitado: InvitadoModel, menuRef: any): void {
    const ev = this.evento();
    const items: MenuItem[] = [];

    if (this.tieneInvitacion()) {
      items.push({
        label: 'Enviar Invitación (WhatsApp)',
        icon: 'pi pi-whatsapp',
        command: () => this.enviarInvitacionWhatsApp(invitado),
      });
    }

    items.push({
      label: 'Enviar Pase VIP (WhatsApp)',
      icon: 'pi pi-ticket',
      command: () => this.enviarPaseVipWhatsApp(invitado),
    });

    if (
      ev?.modulos?.tipoControlInvitados === 'total' &&
      (invitado.asistira || invitado.estado === 'pendiente')
    ) {
      items.push({
        label: 'Ver Pase QR VIP',
        icon: 'pi pi-qrcode',
        command: () => this.abrirModalQr(invitado),
      });
    }

    items.push(
      {
        separator: true,
      },
      {
        label: 'Ver Detalle',
        icon: 'pi pi-eye',
        command: () => this.abrirModalDetalle(invitado),
      },
      {
        label: 'Editar Invitado',
        icon: 'pi pi-pencil',
        command: () => this.abrirModalEditar(invitado),
      },
    );

    this.menuInvitadoItems = items;
    menuRef.toggle(event);
  }

  // Exporta la lista oficial a formato CSV compatible con Microsoft Excel (BOM UTF-8)
  exportarExcel(): void {
    const lista = this.invitadosFiltrados();
    if (!lista || lista.length === 0) return;

    const encabezados = [
      'Nombre / Familia',
      'Respuesta',
      'Pases Confirmados',
      'Mesa Asignada',
      'Tipo de Menú',
      'Restricciones Alimentarias / Alergias',
      'Teléfono (WhatsApp)',
      'Mensaje / Dedicatoria',
      'Fecha de Confirmación',
    ];

    const filas = lista.map((i) => [
      `"${(i.nombre || '').replace(/"/g, '""')}"`,
      i.asistira ? '"Asistirá"' : '"No podrá asistir"',
      i.asistira ? i.pasesConfirmados || 1 : 0,
      `"${(i.mesa || 'Sin asignar').replace(/"/g, '""')}"`,
      `"${(i.tipoMenu || 'Adulto').replace(/"/g, '""')}"`,
      `"${(i.restriccionesAlimentarias || 'Ninguna').replace(/"/g, '""')}"`,
      `"${(i.telefono || '').replace(/"/g, '""')}"`,
      `"${(i.mensaje || '').replace(/"/g, '""')}"`,
      `"${this.formatearFecha(i.fechaConfirmacion)}"`,
    ]);

    const contenidoCsv =
      '\uFEFF' + [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\r\n');

    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slugEvento = this.evento()?.enlace || 'evento';
    a.download = `Invitados_${slugEvento}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Genera el reporte PDF delegando la lógica pesada a PdfReportService
  async exportarPdf(): Promise<void> {
    await this.pdfReportService.exportarPdf(this.evento(), this.invitadosFiltrados(), {
      filtroRespuesta: this.filtroRespuesta(),
      terminoBusqueda: this.terminoBusqueda(),
    });
  }

  cambiarPasesInvitado(invitado: InvitadoModel, delta: number): void {
    this.cambiarPases.emit({ invitado, delta });
  }

  abrirModalDetalle(invitado: InvitadoModel): void {
    this.abrirDetalle.emit(invitado);
  }

  abrirModalEditar(invitado: InvitadoModel): void {
    this.abrirEditar.emit(invitado);
  }

  abrirModalCrearInvitado(): void {
    this.crearInvitado.emit();
  }

  abrirModalCompartir(): void {
    this.compartir.emit();
  }

  abrirModalQr(invitado: InvitadoModel): void {
    this.abrirQr.emit(invitado);
  }

  enviarInvitacionWhatsApp(invitado: InvitadoModel): void {
    this.enviarInvitacionWa.emit(invitado);
  }

  enviarPaseVipWhatsApp(invitado: InvitadoModel): void {
    this.enviarPaseWa.emit(invitado);
  }

  private formatearFecha(fecha: any): string {
    if (!fecha) return '-';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
