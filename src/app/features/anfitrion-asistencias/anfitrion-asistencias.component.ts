import { Component, OnDestroy, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { InvitadoModel } from '../../core/models/invitado.model';
import { RecuerdoModel } from '../../core/models/RecuerdoModel';
import JSZip from 'jszip';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { QrMesaModalComponent } from '../album-digital/qr-mesa-modal/qr-mesa-modal';
import { InvitadoDetalleModalComponent } from './components/invitado-detalle-modal/invitado-detalle-modal';
import { InvitadoEditarModalComponent } from './components/invitado-editar-modal/invitado-editar-modal';
import { InputTextModule } from 'primeng/inputtext';

import { TooltipModule } from 'primeng/tooltip';
import QRCode from 'qrcode';
import { capturarYDescargarTarjetaPaseWeb } from '../../core/utils/image-compresor';
@Component({
  selector: 'app-anfitrion-asistencias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    TagModule,
    ButtonModule,
    ProgressSpinnerModule,
    InputTextModule,
    DynamicDialogModule,
    TooltipModule,
  ],
  providers: [DialogService],
  templateUrl: './anfitrion-asistencias.component.html',
  styleUrl: './anfitrion-asistencias.component.scss',
})
export class AnfitrionAsistenciasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private dialogService = inject(DialogService);

  evento = signal<Evento | null>(null);
  invitados = signal<InvitadoModel[]>([]);
  cargando = signal<boolean>(true);
  notFound = signal<boolean>(false);

  // Control de descargas
  descargandoTodo = signal<boolean>(false);
  progresoDescarga = signal<string>('');

  // Control de PIN
  pinIngresado = '';
  pinDesbloqueado = signal<boolean>(false);
  errorPin = signal<boolean>(false);

  // Pestañas del portal anfitrión
  // Pestañas del portal anfitrión
  pestanaActiva = signal<'invitados' | 'recepcion' | 'album'>('invitados');

  // Métricas de Aforo y Recepción en Vivo
  totalIngresados = computed(() =>
    this.invitados()
      .filter((i) => i.haIngresado)
      .reduce((acc, i) => acc + (i.pasesIngresados ?? i.pasesConfirmados ?? 1), 0),
  );
  totalPendientes = computed(() => Math.max(0, this.totalPases() - this.totalIngresados()));
  porcentajeAsistencia = computed(() => {
    const tot = this.totalPases();
    return tot > 0 ? Math.min(100, Math.round((this.totalIngresados() / tot) * 100)) : 0;
  });
  // Modal de visualización de QR individual para el anfitrión
  invitadoModalQr = signal<{
    invitado: InvitadoModel;
    qrDataUrl: string;
  } | null>(null);
  // Estado del Escáner de Cámara y Check-in
  escanerActivo = signal<boolean>(false);
  html5QrCodeInstance: any = null;
  procesandoCheckIn = signal<boolean>(false);
  resultadoEscaneo = signal<{
    tipo: 'exito' | 'duplicado' | 'invalido';
    mensaje: string;
    invitado?: InvitadoModel;
    hora?: string;
  } | null>(null);

  // Búsqueda manual de respaldo en recepción
  busquedaRecepcion = signal<string>('');
  invitadosRecepcionFiltrados = computed(() => {
    const lista = this.invitados().filter((i) => i.asistira);
    const q = this.busquedaRecepcion().trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (i) =>
        (i.nombre || '').toLowerCase().includes(q) || (i.telefono || '').toLowerCase().includes(q),
    );
  });
  // Recuerdos del álbum colaborativo
  recuerdos = signal<RecuerdoModel[]>([]);
  eliminandoId = signal<string | null>(null);

  // Métricas
  totalPases = signal<number>(0);
  totalConfirmados = signal<number>(0);
  totalCancelados = signal<number>(0);

  // Búsqueda en tiempo real por texto
  terminoBusqueda = signal<string>('');

  // Filtros de asistencia
  filtroRespuesta = signal<'todos' | 'asistira' | 'no_asiste'>('todos');

  // Lista reactiva filtrada según estado y texto de búsqueda
  invitadosFiltrados = computed(() => {
    let lista = this.invitados();
    const filtro = this.filtroRespuesta();
    if (filtro === 'asistira') {
      lista = lista.filter((i) => i.asistira);
    } else if (filtro === 'no_asiste') {
      lista = lista.filter((i) => !i.asistira);
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

  // Exporta la lista oficial a formato CSV compatible con Microsoft Excel (BOM UTF-8)
  exportarExcel(): void {
    const lista = this.invitadosFiltrados();
    if (!lista || lista.length === 0) return;

    const encabezados = [
      'Nombre / Familia',
      'Respuesta',
      'Pases Confirmados',
      'Teléfono (WhatsApp)',
      'Mensaje / Dedicatoria',
      'Fecha de Confirmación',
    ];

    const filas = lista.map((i) => [
      `"${(i.nombre || '').replace(/"/g, '""')}"`,
      i.asistira ? '"Asistirá"' : '"No podrá asistir"',
      i.asistira ? i.pasesConfirmados || 1 : 0,
      `"${(i.telefono || '').replace(/"/g, '""')}"`,
      `"${(i.mensaje || '').replace(/"/g, '""')}"`,
      `"${this.formatearFecha(i.fechaConfirmacion)}"`,
    ]);

    // \uFEFF fuerza a Excel a reconocer acentos y la letra 'ñ' en español
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

  // Genera y descarga directamente el archivo .pdf oficial con jspdf y jspdf-autotable
  async exportarPdf(): Promise<void> {
    const lista = this.invitadosFiltrados();
    if (!lista || lista.length === 0) return;
    const ev = this.evento();

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    // 1. Encabezado del Evento (Sin barra superior)
    const categoriaEvento = (ev?.preTitulo || ev?.tipo || 'Nuestra Boda').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 166, 51); // Dorado NahoFlo #cca633
    doc.text(`${categoriaEvento} - LISTA OFICIAL DE ASISTENCIA`, 14, 16);

    // Título principal del evento (ej: Yesenia & Ismael)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(ev?.titulo || 'Lista de Asistencias', 14, 25);

    // Subtítulo con filtros y fecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // #64748b
    const fechaHoy = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
    const filtroLabel =
      this.filtroRespuesta() === 'asistira'
        ? 'Confirmados'
        : this.filtroRespuesta() === 'no_asiste'
          ? 'Declinados'
          : 'Todos los estados';
    const busquedaLabel = this.terminoBusqueda().trim()
      ? ` | Búsqueda: "${this.terminoBusqueda().trim()}"`
      : '';
    doc.text(
      `Emisión: ${fechaHoy} | Filtro: ${filtroLabel}${busquedaLabel} | Registros: ${lista.length}`,
      14,
      31,
    );

    // 2. Bloque de Métricas Filtradas
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 35, 188, 14, 2, 2, 'FD');

    const pasesFiltrados = lista
      .filter((i) => i.asistira)
      .reduce((acc, i) => acc + (i.pasesConfirmados || 1), 0);
    const confirmadosCount = lista.filter((i) => i.asistira).length;
    const declinadosCount = lista.filter((i) => !i.asistira).length;

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PASES CONFIRMADOS:', 20, 40.5);
    doc.text('CONFIRMADOS (SÍ):', 85, 40.5);
    doc.text('DECLINARON (NO):', 148, 40.5);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(161, 98, 7); // #a16207
    doc.text(`${pasesFiltrados}`, 20, 46);
    doc.setTextColor(21, 128, 61); // #15803d
    doc.text(`${confirmadosCount}`, 85, 46);
    doc.setTextColor(220, 38, 38); // #dc2626
    doc.text(`${declinadosCount}`, 148, 46);

    // 3. Tabla de Invitados con jsPDF-AutoTable
    const tableData = lista.map((i, idx) => [
      idx + 1,
      i.nombre || '-',
      i.asistira ? 'Confirmado' : 'Declinado',
      i.asistira ? (i.pasesConfirmados || 1).toString() : '0',
      i.telefono || '-',
      i.mensaje ? `"${i.mensaje}"` : '-',
      this.formatearFecha(i.fechaConfirmacion),
    ]);

    autoTable(doc, {
      startY: 52,
      head: [
        [
          '#',
          'Nombre / Familia',
          'Respuesta',
          'Pases',
          'WhatsApp',
          'Dedicatoria / Mensaje',
          'Fecha',
        ],
      ],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [204, 166, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 249],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 42, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
        4: { cellWidth: 26 },
        5: { cellWidth: 48, fontStyle: 'italic', textColor: [71, 85, 105] },
        6: { halign: 'center', cellWidth: 28, fontSize: 7 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'Confirmado') {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14, bottom: 20 },
      didDrawPage: () => {
        const pageNum = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);

        // Línea sutil de separación inferior
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, 268, 202, 268);

        // Atribución de NahoFlo a la izquierda
        doc.text('Documento oficial generado por NahoFlo Creative Studio · nahoflo.com', 14, 273);

        // Número de página a la derecha
        doc.text(`Página ${pageNum}`, 202, 273, { align: 'right' });
      },
    });

    // 4. Descarga inmediata del archivo .pdf
    const slug = ev?.enlace || 'evento';
    const fechaDescarga = new Date().toISOString().slice(0, 10);
    doc.save(`Lista_Invitados_${slug}_${fechaDescarga}.pdf`);
  }

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.notFound.set(true);
      this.cargando.set(false);
      return;
    }

    try {
      const ev = await this.eventService.getEventBySlug(slug);
      if (ev) {
        this.evento.set(ev);

        // Si el control de invitados está inactivo pero tiene álbum, iniciamos en la pestaña de fotos
        if (ev.modulos?.tipoControlInvitados === 'inactivo' && ev.modulos?.tieneAlbum) {
          this.pestanaActiva.set('album');
        }

        // Si ya había ingresado el PIN en esta sesión, lo recordamos
        const pinSesion = sessionStorage.getItem(`pin_${ev.id}`);
        if (pinSesion && pinSesion === ev.pinAnfitrion && ev.id) {
          const tareas: Promise<any>[] = [];
          this.pinDesbloqueado.set(true);
          if (!ev.modulos || ev.modulos.tipoControlInvitados !== 'inactivo') {
            tareas.push(this.cargarInvitados(ev.id));
          }
          if (!ev.modulos || ev.modulos.tieneAlbum) {
            tareas.push(this.cargarRecuerdos(ev.id));
          }
          await Promise.all(tareas);
        }
      } else {
        this.notFound.set(true);
      }
    } catch (e) {
      console.error('Error al cargar evento de anfitrión:', e);
      this.notFound.set(true);
    } finally {
      this.cargando.set(false);
    }
  }
  async verificarPin() {
    const ev = this.evento();
    if (!ev || !ev.id) return;

    if (this.pinIngresado.trim() === ev.pinAnfitrion) {
      this.errorPin.set(false);
      this.pinDesbloqueado.set(true);
      sessionStorage.setItem(`pin_${ev.id}`, this.pinIngresado.trim());

      const tareas: Promise<any>[] = [];
      if (!ev.modulos || ev.modulos.tipoControlInvitados !== 'inactivo') {
        tareas.push(this.cargarInvitados(ev.id));
      }
      if (!ev.modulos || ev.modulos.tieneAlbum) {
        tareas.push(this.cargarRecuerdos(ev.id));
      }
      await Promise.all(tareas);
    } else {
      this.errorPin.set(true);
    }
  }

  async cargarInvitados(eventoId: string) {
    this.cargando.set(true);
    try {
      const lista = await this.eventService.getInvitados(eventoId);
      const normalizada = lista.map((i) => ({
        ...i,
        fechaConfirmacion: i.fechaConfirmacion?.toDate
          ? i.fechaConfirmacion.toDate()
          : i.fechaConfirmacion
            ? new Date(i.fechaConfirmacion)
            : null,
      }));
      this.invitados.set(normalizada);

      // Calcular KPIs
      const pases = normalizada
        .filter((i) => i.asistira)
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      const confirmados = normalizada.filter((i) => i.asistira).length;
      const cancelados = normalizada.filter((i) => !i.asistira).length;

      this.totalPases.set(pases);
      this.totalConfirmados.set(confirmados);
      this.totalCancelados.set(cancelados);
    } catch (error) {
      console.error('Error cargando invitados:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  // Restablece todos los filtros de la tabla PrimeNG v17
  clear(table: Table) {
    table.clear();
    this.terminoBusqueda.set('');
    this.filtroRespuesta.set('todos');
  }

  // Abre modal de detalle completo del invitado con PrimeNG DialogService
  abrirModalDetalle(invitado: InvitadoModel): void {
    const ref = this.dialogService.open(InvitadoDetalleModalComponent, {
      header: 'Detalle del Invitado',
      width: '540px',
      breakpoints: { '960px': '75vw', '640px': '92vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        evento: this.evento(),
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.accion === 'editar' && resultado.invitado) {
        this.abrirModalEditar(resultado.invitado);
      }
    });
  }

  // Abre modal de edición del invitado con PrimeNG DialogService
  abrirModalEditar(invitado: InvitadoModel): void {
    const ev = this.evento();
    if (!ev?.id) return;

    const ref = this.dialogService.open(InvitadoEditarModalComponent, {
      header: 'Editar Invitado',
      width: '520px',
      breakpoints: { '960px': '75vw', '640px': '92vw' },
      closable: true,
      dismissableMask: true,
      data: {
        invitado,
        eventoId: ev.id,
      },
    });

    ref?.onClose.subscribe((resultado: any) => {
      if (resultado?.guardado) {
        this.cargarInvitados(ev.id!);
      }
    });
  }

  formatearFecha(fecha: any): string {
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
  async cargarRecuerdos(eventoId: string): Promise<void> {
    try {
      const lista = await this.eventService.getRecuerdos(eventoId);
      this.recuerdos.set(lista);
    } catch (error) {
      console.error('Error al cargar recuerdos del álbum:', error);
    }
  }

  async eliminarRecuerdo(recuerdo: RecuerdoModel): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !recuerdo.id) return;

    const seguro = confirm(
      `¿Estás seguro de eliminar el recuerdo de "${recuerdo.nombreAutor}"? Se retirará del álbum inmediatamente.`,
    );
    if (!seguro) return;

    this.eliminandoId.set(recuerdo.id);
    try {
      await this.eventService.eliminarRecuerdo(ev.id, recuerdo.id);
      this.recuerdos.update((lista) => lista.filter((r) => r.id !== recuerdo.id));
    } catch (error) {
      console.error('Error al eliminar recuerdo:', error);
      alert('Ocurrió un error al eliminar la foto. Intenta de nuevo.');
    } finally {
      this.eliminandoId.set(null);
    }
  }

  contarFotosTotales(): number {
    return this.recuerdos().reduce((total, r) => {
      const cant = r.fotosUrls && r.fotosUrls.length > 0 ? r.fotosUrls.length : r.fotoUrl ? 1 : 0;
      return total + cant;
    }, 0);
  }

  // Descarga las fotos de una publicación específica (en .jpg si es 1, o en .zip si es carrusel)
  async descargarRecuerdo(recuerdo: RecuerdoModel, event: Event): Promise<void> {
    event.stopPropagation();
    const fotos =
      recuerdo.fotosUrls && recuerdo.fotosUrls.length > 0
        ? recuerdo.fotosUrls
        : recuerdo.fotoUrl
          ? [recuerdo.fotoUrl]
          : [];

    if (fotos.length === 0) return;

    const autorLimpio = recuerdo.nombreAutor.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');

    // 1. Si es 1 sola foto, descarga directa .jpg
    if (fotos.length === 1) {
      await this.descargarDirecto(fotos[0], `Recuerdo_${autorLimpio}.jpg`);
      return;
    }

    // 2. Si es carrusel (+1 foto), empaqueta en ZIP
    try {
      const zip = new JSZip();
      for (let i = 0; i < fotos.length; i++) {
        const resp = await fetch(fotos[i]);
        const blob = await resp.blob();
        zip.file(`Foto_${i + 1}_${autorLimpio}.jpg`, blob);
      }
      const contenidoZip = await zip.generateAsync({ type: 'blob' });
      this.dispararDescargaBlob(contenidoZip, `Recuerdo_${autorLimpio}_Carrusel.zip`);
    } catch (error) {
      console.error('Error al generar ZIP del recuerdo:', error);
    }
  }

  // Descarga TODO el álbum de la fiesta empaquetado en un solo archivo ZIP
  async descargarTodasLasFotos(): Promise<void> {
    const lista = this.recuerdos();
    const ev = this.evento();
    if (lista.length === 0 || this.descargandoTodo()) return;

    // Recopilar todas las fotos
    const fotosParaDescargar: { url: string; nombre: string }[] = [];
    lista.forEach((recuerdo) => {
      const fotos =
        recuerdo.fotosUrls && recuerdo.fotosUrls.length > 0
          ? recuerdo.fotosUrls
          : recuerdo.fotoUrl
            ? [recuerdo.fotoUrl]
            : [];
      const autorLimpio = recuerdo.nombreAutor.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');

      fotos.forEach((url, idx) => {
        const sufijo = fotos.length > 1 ? `_foto${idx + 1}` : '';
        fotosParaDescargar.push({
          url,
          nombre: `${autorLimpio}${sufijo}_${Date.now().toString().slice(-4)}.jpg`,
        });
      });
    });

    if (fotosParaDescargar.length === 0) return;

    this.descargandoTodo.set(true);

    try {
      // Si solo hay 1 foto en todo el álbum, la baja directa
      if (fotosParaDescargar.length === 1) {
        this.progresoDescarga.set('Descargando...');
        await this.descargarDirecto(fotosParaDescargar[0].url, fotosParaDescargar[0].nombre);
        return;
      }

      // Si hay más de 1 foto, creamos el archivo ZIP completo
      const zip = new JSZip();
      const carpeta = zip.folder('Fotos_Recuerdos') || zip;

      for (let i = 0; i < fotosParaDescargar.length; i++) {
        const item = fotosParaDescargar[i];
        this.progresoDescarga.set(`Preparando ${i + 1} de ${fotosParaDescargar.length}...`);

        try {
          const resp = await fetch(item.url);
          const blob = await resp.blob();
          carpeta.file(item.nombre, blob);
        } catch (err) {
          console.error('Error al agregar foto al ZIP:', err);
        }
      }

      this.progresoDescarga.set('Comprimiendo ZIP...');
      const contenidoZip = await zip.generateAsync({ type: 'blob' });

      const eventoTitulo = ev?.titulo
        ? ev.titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')
        : 'Evento';
      const nombreZip = `Album_Recuerdos_${eventoTitulo}.zip`;

      this.dispararDescargaBlob(contenidoZip, nombreZip);
    } catch (error) {
      console.error('Error al generar ZIP completo:', error);
      alert('Ocurrió un error al empaquetar el ZIP.');
    } finally {
      this.descargandoTodo.set(false);
      this.progresoDescarga.set('');
    }
  }

  private async descargarDirecto(url: string, nombreArchivo: string): Promise<void> {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      this.dispararDescargaBlob(blob, nombreArchivo);
    } catch {
      window.open(url, '_blank');
    }
  }

  private dispararDescargaBlob(blob: Blob, nombreArchivo: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = blobUrl;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  abrirModalQrMesas(): void {
    const ev = this.evento();
    if (!ev) return;

    this.dialogService.open(QrMesaModalComponent, {
      header: 'Tarjeta QR para Centros de Mesa',
      width: '560px',
      breakpoints: { '640px': '95vw' },
      dismissableMask: true,
      focusOnShow: false,
      data: { evento: ev },
    });
  }

  // --- MÓDULO RECEPCIÓN Y CONTROL TOTAL VIP ---

  // Sintetizador de audio nativo (sonido agradable en éxito, alerta en duplicado)
  reproducirSonido(tipo: 'exito' | 'alerta'): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (tipo === 'exito') {
        // Doble tono ascendente tipo "ding-ding"
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Tono grave de alerta
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Si el navegador bloquea audio sin interacción previa, no afecta el flujo
    }
  }

  // Activa o desactiva la cámara del dispositivo
  async toggleEscaner(): Promise<void> {
    if (this.escanerActivo()) {
      await this.detenerEscaner();
    } else {
      await this.iniciarEscaner();
    }
  }

  async iniciarEscaner(): Promise<void> {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.escanerActivo.set(true);
      this.resultadoEscaneo.set(null);

      setTimeout(async () => {
        try {
          this.html5QrCodeInstance = new Html5Qrcode('qr-reader');
          await this.html5QrCodeInstance.start(
            { facingMode: 'environment' }, // Cámara trasera del celular
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText: string) => {
              this.procesarCodigoEscaneado(decodedText);
            },
            () => {},
          );
        } catch (err) {
          console.error('Error al iniciar cámara:', err);
          this.escanerActivo.set(false);
        }
      }, 250);
    } catch (e) {
      console.error('Error al importar html5-qrcode:', e);
      this.escanerActivo.set(false);
    }
  }

  async detenerEscaner(): Promise<void> {
    if (this.html5QrCodeInstance) {
      try {
        await this.html5QrCodeInstance.stop();
        await this.html5QrCodeInstance.clear();
      } catch (e) {
        console.error('Error al detener cámara:', e);
      }
      this.html5QrCodeInstance = null;
    }
    this.escanerActivo.set(false);
  }

  // Procesa el payload JSON leído del QR
  async procesarCodigoEscaneado(decodedText: string): Promise<void> {
    if (this.procesandoCheckIn()) return;
    this.procesandoCheckIn.set(true);

    try {
      let data: { evId: string; invId: string; slug: string };
      try {
        data = JSON.parse(decodedText);
      } catch {
        this.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'El código escaneado no es un pase válido de NahoFlo Events.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      const ev = this.evento();
      if (!ev || data.evId !== ev.id) {
        this.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'Este pase pertenece a otro evento.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      const invitado = this.invitados().find((i) => i.id === data.invId);
      if (!invitado) {
        this.reproducirSonido('alerta');
        this.resultadoEscaneo.set({
          tipo: 'invalido',
          mensaje: 'Invitado no encontrado en la lista oficial.',
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2000);
        return;
      }

      if (invitado.haIngresado) {
        this.reproducirSonido('alerta');
        const horaStr = this.formatearFecha(invitado.horaIngreso);
        this.resultadoEscaneo.set({
          tipo: 'duplicado',
          mensaje: `¡Pase ya utilizado previamente a las ${horaStr}!`,
          invitado,
          hora: horaStr,
        });
        setTimeout(() => this.procesandoCheckIn.set(false), 2500);
        return;
      }

      await this.hacerCheckIn(invitado);
    } finally {
      setTimeout(() => this.procesandoCheckIn.set(false), 1500);
    }
  }

  // Registra el ingreso en Firestore y actualiza el estado local en vivo
  async hacerCheckIn(invitado: InvitadoModel, pases?: number): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !invitado.id) return;

    const pasesEfectivos = pases ?? (invitado.pasesConfirmados || 1);
    await this.eventService.registrarCheckIn(ev.id, invitado.id, pasesEfectivos);

    const ahora = new Date();
    this.invitados.update((lista) =>
      lista.map((i) =>
        i.id === invitado.id
          ? { ...i, haIngresado: true, horaIngreso: ahora, pasesIngresados: pasesEfectivos }
          : i,
      ),
    );

    this.reproducirSonido('exito');
    this.resultadoEscaneo.set({
      tipo: 'exito',
      mensaje: `¡Acceso Autorizado! Bienvenido(a) ${invitado.nombre}.`,
      invitado: { ...invitado, haIngresado: true, pasesIngresados: pasesEfectivos },
      hora: ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Permite al recepcionista deshacer el check-in si se equivocó
  async revertirCheckIn(invitado: InvitadoModel): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !invitado.id) return;

    await this.eventService.revertirCheckIn(ev.id, invitado.id);

    this.invitados.update((lista) =>
      lista.map((i) =>
        i.id === invitado.id
          ? { ...i, haIngresado: false, horaIngreso: null, pasesIngresados: 0 }
          : i,
      ),
    );

    if (this.resultadoEscaneo()?.invitado?.id === invitado.id) {
      this.resultadoEscaneo.set(null);
    }
  }

  // Apaga la cámara si el anfitrión cambia de ruta
  ngOnDestroy(): void {
    this.detenerEscaner();
  }

  // Abre el modal con el QR generado en tiempo real para el anfitrión
  async abrirModalQr(invitado: InvitadoModel): Promise<void> {
    const ev = this.evento();
    if (!ev?.id || !invitado.id) return;

    const payloadQr = JSON.stringify({
      evId: ev.id,
      invId: invitado.id,
      slug: ev.enlace,
    });

    const qrUrl = await QRCode.toDataURL(payloadQr, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });

    this.invitadoModalQr.set({
      invitado,
      qrDataUrl: qrUrl,
    });
  }

  cerrarModalQr(): void {
    this.invitadoModalQr.set(null);
  }

  async descargarQrInvitado(): Promise<void> {
    const modal = this.invitadoModalQr();
    if (!modal) return;

    const cardEl = document.querySelector('.modal-card-qr') as HTMLElement;
    if (cardEl) {
      await capturarYDescargarTarjetaPaseWeb(cardEl, modal.invitado.nombre);
    }
  }

  // Genera el mensaje personalizado y comparte el QR nativo o al portapapeles
  // Genera el mensaje oficial con el enlace directo al Pase Digital VIP
  compartirQrWhatsApp(): void {
    const modal = this.invitadoModalQr();
    const ev = this.evento();
    if (!modal || !ev) return;

    const nombre = modal.invitado.nombre;
    const pases = modal.invitado.pasesConfirmados || 1;
    const pasesTexto = pases === 1 ? '1 persona' : `${pases} personas`;
    const telefono = (modal.invitado.telefono || '').replace(/\D/g, '');

    // Enlace directo al Pase Digital del invitado
    const urlPase = `${window.location.origin}/e/${ev.enlace}?pase=${modal.invitado.id}`;

    const mensaje = `¡Hola ${nombre}! 🎉\n\nAquí tienes tu Pase Digital VIP para *${ev.titulo}*.\n🎟️ Acceso autorizado para: *${pasesTexto}*.\n\n📲 Abre tu Pase con Código QR aquí:\n${urlPase}\n\nPresenta tu código en la recepción al llegar.\n¡Nos dará muchísimo gusto celebrar contigo! ✨`;

    const urlWa = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    window.open(urlWa, '_blank');
  }

  // Permite al anfitrión ajustar el número de pases asignados a un invitado
  async cambiarPasesInvitado(invitado: InvitadoModel, delta: number): Promise<void> {
    const evId = this.evento()?.id;
    const invId = invitado.id;
    if (!invId || !evId) return;

    const actual = invitado.pasesConfirmados || 1;
    const nuevo = Math.max(1, actual + delta);
    if (nuevo === actual) return;

    // Actualización reactiva inmediata
    this.invitados.update((lista) =>
      lista.map((i) => (i.id === invId ? { ...i, pasesConfirmados: nuevo } : i))
    );

    // Si el modal de este invitado está abierto, actualizarlo también
    this.invitadoModalQr.update((m) =>
      m && m.invitado.id === invId
        ? { ...m, invitado: { ...m.invitado, pasesConfirmados: nuevo } }
        : m
    );

    // Actualizar KPI de pases
    const pasesTotales = this.invitados()
      .filter((i) => i.asistira)
      .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
    this.totalPases.set(pasesTotales);

    try {
      await this.eventService.actualizarPasesInvitado(evId, invId, nuevo);
    } catch (err) {
      console.error('Error al actualizar pases del invitado:', err);
      // Revertir en caso de error
      this.invitados.update((lista) =>
        lista.map((i) => (i.id === invId ? { ...i, pasesConfirmados: actual } : i))
      );
      this.invitadoModalQr.update((m) =>
        m && m.invitado.id === invId
          ? { ...m, invitado: { ...m.invitado, pasesConfirmados: actual } }
          : m
      );
      const pasesTotalesRev = this.invitados()
        .filter((i) => i.asistira)
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      this.totalPases.set(pasesTotalesRev);
    }
  }
}
