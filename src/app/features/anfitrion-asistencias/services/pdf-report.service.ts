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
      i.mesa || 'Sin mesa',
      i.tipoMenu || 'Adulto',
      i.restriccionesAlimentarias || '-',
      i.telefono || '-',
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
          'Mesa',
          'Menú',
          'Alergias / Restricciones',
          'WhatsApp',
          'Fecha',
        ],
      ],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [204, 166, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 249],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { cellWidth: 35, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        4: { cellWidth: 20, fontStyle: 'bold', textColor: [161, 98, 7] },
        5: { cellWidth: 18 },
        6: { cellWidth: 32, textColor: [185, 28, 28] },
        7: { cellWidth: 22 },
        8: { halign: 'center', cellWidth: 22, fontSize: 7 },
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

  /**
   * Genera y descarga el Dossier PDF Consolidado del Evento.
   * Incluye Ficha Técnica, Minutario Técnico, Distribución de Mesas/Alergias y Directorio de Proveedores.
   */
  async generarDossierCompletoEvento(evento: Evento | null, invitados: InvitadoModel[]): Promise<void> {
    if (!evento) return;

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const agencia = evento.agenciaNombre || 'NahoFlo Event Studio';

    // 1. ENCABEZADO PRINCIPAL (PORTADA DEL DOSSIER)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 166, 51); // Dorado NahoFlo #cca633
    doc.text(`DOSSIER COMPLETO DE COORDINACIÓN · ${agencia.toUpperCase()}`, 14, 16);

    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(evento.titulo || 'Dossier del Evento', 14, 26);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const fechaEventoStr = evento.fecha ? this.formatearFechaLarga(evento.fecha) : 'Fecha por definir';
    doc.text(`Tipo: ${evento.tipo || 'Evento Social'} | Fecha: ${fechaEventoStr}`, 14, 32);

    let startY = 38;

    // 2. FICHA TÉCNICA DEL EVENTO
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY, 188, 28, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('FICHA TÉCNICA DE UBICACIONES Y CONTACTO', 18, startY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    const ceremonia = evento.ceremoniaLugar || 'No especificada';
    const recepcion = evento.recepcionLugar || 'No especificada';
    const contacto = evento.contactoNombre ? `${evento.contactoNombre} (${evento.contactoTelefono || 'Sin tel'})` : 'No especificado';
    const planner = evento.agenciaNombre ? `${evento.agenciaNombre} (${evento.agenciaTelefono || 'Sin tel'})` : 'NahoFlo Events';

    doc.text(`Ceremonia: ${ceremonia}`, 18, startY + 12);
    doc.text(`Recepción: ${recepcion}`, 18, startY + 17);
    doc.text(`Contacto Anfitrión: ${contacto}`, 18, startY + 22);
    doc.text(`Coordinación / Planner: ${planner}`, 110, startY + 22);

    startY += 34;

    // 3. SECCIÓN: MINUTARIO TÉCNICO / RUN-OF-SHOW
    if (evento.minutario && evento.minutario.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. CRONOGRAMA & MINUTARIO TÉCNICO', 14, startY);
      startY += 4;

      const filasMinutario = evento.minutario.map((m) => [
        m.hora || '--:--',
        m.actividad || '-',
        m.responsable || 'Coordinación',
        m.detalles || '-',
      ]);

      autoTable(doc, {
        startY,
        head: [['Hora', 'Momento / Actividad', 'Responsable', 'Notas / Requerimientos Técnicos']],
        body: filasMinutario,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold', textColor: [161, 98, 7] },
          1: { cellWidth: 55, fontStyle: 'bold' },
          2: { cellWidth: 35 },
          3: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // 4. SECCIÓN: DISTRIBUCIÓN DE MESAS, MENÚS Y ALERGIAS
    if (invitados && invitados.length > 0) {
      // Si la tabla anterior dejó poco espacio, agregamos nueva página
      if (startY > 220) {
        doc.addPage();
        startY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. DISTRIBUCIÓN DE MESAS, MENÚS Y RESTRICCIONES ALIMENTARIAS', 14, startY);
      startY += 4;

      const invitadosConMesa = invitados.filter((i) => i.asistira);
      const filasMesas = invitadosConMesa.map((i) => [
        i.mesa || 'Sin Mesa',
        i.nombre || 'Invitado',
        String(i.pasesConfirmados || 1),
        i.tipoMenu || 'Estándar',
        i.restriccionesAlimentarias || 'Ninguna',
      ]);

      autoTable(doc, {
        startY,
        head: [['Mesa', 'Invitado Principal', 'Pases', 'Menú', 'Alergias / Restricciones']],
        body: filasMesas,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 24, fontStyle: 'bold', textColor: [204, 166, 51] },
          1: { cellWidth: 55, fontStyle: 'bold' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            if (data.cell.raw && data.cell.raw !== 'Ninguna') {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // 5. SECCIÓN: DIRECTORIO DE PROVEEDORES DEL EVENTO
    if (evento.proveedores && evento.proveedores.length > 0) {
      if (startY > 220) {
        doc.addPage();
        startY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('3. DIRECTORIO DE PROVEEDORES Y CONTACTOS DE EMERGENCIA STAFF', 14, startY);
      startY += 4;

      const filasProveedores = evento.proveedores.map((p) => [
        p.categoria || 'Proveedor',
        p.empresa || '-',
        p.contactoNombre || '-',
        p.telefono || '-',
        p.notas || '-',
      ]);

      autoTable(doc, {
        startY,
        head: [['Categoría', 'Empresa / Proveedor', 'Contacto', 'Teléfono', 'Notas del Servicio']],
        body: filasProveedores,
        theme: 'striped',
        headStyles: {
          fillColor: [88, 28, 135], // Púrpura elegante
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },
          1: { cellWidth: 45, fontStyle: 'bold' },
          2: { cellWidth: 35 },
          3: { cellWidth: 30, textColor: [15, 118, 110], fontStyle: 'bold' },
          4: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 },
      });
    }

    // Pie de página en todas las páginas
    const totalPaginas = doc.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, 268, 202, 268);

      doc.text(`Dossier Oficial de Coordinación · ${agencia} · NahoFlo Events`, 14, 273);
      doc.text(`Página ${p} de ${totalPaginas}`, 202, 273, { align: 'right' });
    }

    const slug = evento.enlace || 'evento';
    const fechaDescarga = new Date().toISOString().slice(0, 10);
    doc.save(`Dossier_Coordinacion_${slug}_${fechaDescarga}.pdf`);
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

  private formatearFechaLarga(fecha: any): string {
    if (!fecha) return '-';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
  }
}

