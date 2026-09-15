import { Injectable } from '@angular/core';
import { Evento } from '../../../core/models/event.model';
import { InvitadoModel } from '../../../core/models/invitado.model';

export interface OpcionesReportePdf {
  filtroRespuesta?: 'todos' | 'asistira' | 'pendiente' | 'no_asiste' | string;
  terminoBusqueda?: string;
}

/**
 * Servicio encargado de la generación y exportación del reporte oficial en PDF
 * de la lista de asistencia y control de invitados.
 * Implementa Lazy Loading dinámico para 'jspdf' y 'jspdf-autotable' para
 * optimizar el bundle principal.
 */
@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  /**
   * Genera y descarga el documento PDF con el diseño y métricas oficiales de NahoFlo Events.
   */
  async exportarPdf(
    evento: Evento | null,
    lista: InvitadoModel[],
    opciones: OpcionesReportePdf = {},
  ): Promise<void> {
    if (!lista || lista.length === 0) return;

    // Carga perezosa (Lazy Loading) de jsPDF y jsPDF-AutoTable
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    // 1. Encabezado del Evento
    const categoriaEvento = (evento?.preTitulo || evento?.tipo || 'Nuestra Boda').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 166, 51); // Dorado NahoFlo #cca633
    doc.text(`${categoriaEvento} - LISTA OFICIAL DE ASISTENCIA`, 14, 16);

    // Título principal del evento (ej: Yesenia & Ismael)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(evento?.titulo || 'Lista de Asistencias', 14, 25);

    // Subtítulo con filtros y fecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // #64748b
    const fechaHoy = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
    const filtroLabel =
      opciones.filtroRespuesta === 'asistira'
        ? 'Confirmados'
        : opciones.filtroRespuesta === 'no_asiste'
          ? 'Declinados'
          : 'Todos los estados';
    const busquedaLabel = opciones.terminoBusqueda?.trim()
      ? ` | Búsqueda: "${opciones.terminoBusqueda.trim()}"`
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
    const slug = evento?.enlace || 'evento';
    const fechaDescarga = new Date().toISOString().slice(0, 10);
    doc.save(`Lista_Invitados_${slug}_${fechaDescarga}.pdf`);
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
