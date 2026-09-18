import { Injectable } from '@angular/core';
import type { jsPDF as JsPdfDocument } from 'jspdf';
import type { CellHookData, RowInput } from 'jspdf-autotable';

export type GuestResponseFilter = 'todos' | 'asistira' | 'pendiente' | 'no_asiste';

export interface TimestampLike {
  toDate(): Date;
}

export type DateLike = Date | string | number | TimestampLike | null | undefined;

export interface PdfReportEventData {
  preTitulo?: string;
  tipo?: string;
  titulo?: string;
  enlace?: string;
}

export interface PdfReportGuestRow {
  nombre?: string;
  asistira: boolean;
  pasesConfirmados?: number;
  telefono?: string;
  mensaje?: string;
  fechaConfirmacion?: DateLike;
}

export interface PdfReportData {
  evento?: PdfReportEventData | null;
  invitados: PdfReportGuestRow[];
  filtroRespuesta: GuestResponseFilter;
  terminoBusqueda?: string;
  fechaEmision?: Date;
}

type JsPdfModule = typeof import('jspdf');
type AutoTableModule = typeof import('jspdf-autotable');

@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  async descargarReporteAsistencia(data: PdfReportData): Promise<void> {
    if (data.invitados.length === 0) {
      return;
    }

    const doc = await this.crearDocumento(data);
    doc.save(this.crearNombreArchivo(data));
  }

  async generarReporteAsistenciaBlob(data: PdfReportData): Promise<Blob | null> {
    if (data.invitados.length === 0) {
      return null;
    }

    const doc = await this.crearDocumento(data);
    return doc.output('blob');
  }

  private async crearDocumento(data: PdfReportData): Promise<JsPdfDocument> {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all<
      [Promise<JsPdfModule>, Promise<AutoTableModule>]
    >([import('jspdf'), import('jspdf-autotable')]);

    const doc = new JsPdf({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    this.dibujarEncabezado(doc, data);
    this.dibujarMetricas(doc, data.invitados);

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
      body: this.crearFilasTabla(data.invitados),
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
      didParseCell: (hookData: CellHookData) => {
        if (hookData.section !== 'body' || hookData.column.index !== 2) {
          return;
        }

        if (hookData.cell.raw === 'Confirmado') {
          hookData.cell.styles.textColor = [21, 128, 61];
          hookData.cell.styles.fontStyle = 'bold';
          return;
        }

        hookData.cell.styles.textColor = [185, 28, 28];
        hookData.cell.styles.fontStyle = 'bold';
      },
      margin: { left: 14, right: 14, bottom: 20 },
      didDrawPage: () => {
        this.dibujarPiePagina(doc);
      },
    });

    return doc;
  }

  private dibujarEncabezado(doc: JsPdfDocument, data: PdfReportData): void {
    const evento = data.evento;
    const categoriaEvento = (evento?.preTitulo || evento?.tipo || 'Nuestra Boda').toUpperCase();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 166, 51);
    doc.text(`${categoriaEvento} - LISTA OFICIAL DE ASISTENCIA`, 14, 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(evento?.titulo || 'Lista de Asistencias', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    const fechaEmision = (data.fechaEmision ?? new Date()).toLocaleDateString('es-MX', {
      dateStyle: 'long',
    });
    const filtroLabel = this.obtenerFiltroLabel(data.filtroRespuesta);
    const busqueda = data.terminoBusqueda?.trim();
    const busquedaLabel = busqueda ? ` | Busqueda: "${busqueda}"` : '';

    doc.text(
      `Emision: ${fechaEmision} | Filtro: ${filtroLabel}${busquedaLabel} | Registros: ${data.invitados.length}`,
      14,
      31,
    );
  }

  private dibujarMetricas(doc: JsPdfDocument, invitados: PdfReportGuestRow[]): void {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 35, 188, 14, 2, 2, 'FD');

    const pasesFiltrados = invitados
      .filter((invitado) => invitado.asistira)
      .reduce((acc, invitado) => acc + (invitado.pasesConfirmados || 1), 0);
    const confirmadosCount = invitados.filter((invitado) => invitado.asistira).length;
    const declinadosCount = invitados.filter((invitado) => !invitado.asistira).length;

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PASES CONFIRMADOS:', 20, 40.5);
    doc.text('CONFIRMADOS (SI):', 85, 40.5);
    doc.text('DECLINARON (NO):', 148, 40.5);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(161, 98, 7);
    doc.text(`${pasesFiltrados}`, 20, 46);
    doc.setTextColor(21, 128, 61);
    doc.text(`${confirmadosCount}`, 85, 46);
    doc.setTextColor(220, 38, 38);
    doc.text(`${declinadosCount}`, 148, 46);
  }

  private crearFilasTabla(invitados: PdfReportGuestRow[]): RowInput[] {
    return invitados.map((invitado, index) => [
      index + 1,
      invitado.nombre || '-',
      invitado.asistira ? 'Confirmado' : 'Declinado',
      invitado.asistira ? String(invitado.pasesConfirmados || 1) : '0',
      invitado.telefono || '-',
      invitado.mensaje ? `"${invitado.mensaje}"` : '-',
      this.formatearFecha(invitado.fechaConfirmacion),
    ]);
  }

  private dibujarPiePagina(doc: JsPdfDocument): void {
    const pageNum = doc.getNumberOfPages();

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 268, 202, 268);
    doc.text('Documento oficial generado por NahoFlo Creative Studio - nahoflo.com', 14, 273);
    doc.text(`Pagina ${pageNum}`, 202, 273, { align: 'right' });
  }

  private obtenerFiltroLabel(filtro: GuestResponseFilter): string {
    if (filtro === 'asistira') {
      return 'Confirmados';
    }

    if (filtro === 'no_asiste') {
      return 'Declinados';
    }

    return 'Todos los estados';
  }

  private formatearFecha(fecha: DateLike): string {
    if (!fecha) {
      return '-';
    }

    const date = this.esTimestampLike(fecha) ? fecha.toDate() : new Date(fecha);

    return Number.isNaN(date.getTime())
      ? '-'
      : date.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  private esTimestampLike(value: DateLike): value is TimestampLike {
    return typeof value === 'object' && value !== null && 'toDate' in value;
  }

  private crearNombreArchivo(data: PdfReportData): string {
    const slug = data.evento?.enlace || 'evento';
    const fechaDescarga = new Date().toISOString().slice(0, 10);

    return `Lista_Invitados_${slug}_${fechaDescarga}.pdf`;
  }
}
