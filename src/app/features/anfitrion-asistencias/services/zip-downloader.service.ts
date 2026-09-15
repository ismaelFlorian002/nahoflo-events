import { Injectable, signal } from '@angular/core';
import { RecuerdoModel } from '../../../core/models/RecuerdoModel';
import { Evento } from '../../../core/models/event.model';

/**
 * Servicio encargado de gestionar las descargas directas de fotos individuales
 * y el empaquetado asíncrono en archivos comprimidos .ZIP para recuerdos y álbumes completos.
 * Implementa Lazy Loading dinámico para 'jszip' evitando cargar la librería en el bundle inicial.
 */
@Injectable({
  providedIn: 'root',
})
export class ZipDownloaderService {
  readonly descargandoTodo = signal<boolean>(false);
  readonly progresoDescarga = signal<string>('');

  /**
   * Descarga las fotos de una publicación específica:
   * - Si es 1 foto: descarga directa en formato .jpg.
   * - Si es un carrusel (+1 foto): empaqueta en .ZIP mediante JSZip.
   */
  async descargarRecuerdo(recuerdo: RecuerdoModel, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

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

    // 2. Si es carrusel (+1 foto), empaqueta en ZIP con Lazy Loading
    try {
      const { default: JSZip } = await import('jszip');
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
      alert('Ocurrió un error al descargar el carrusel de fotos.');
    }
  }

  /**
   * Descarga todo el álbum de la fiesta empaquetado en un único archivo ZIP.
   * Informa el progreso paso a paso reactivamente a través de signals.
   */
  async descargarTodasLasFotos(recuerdos: RecuerdoModel[], evento: Evento | null): Promise<void> {
    if (!recuerdos || recuerdos.length === 0 || this.descargandoTodo()) return;

    // Recopilar todas las fotos
    const fotosParaDescargar: { url: string; nombre: string }[] = [];
    recuerdos.forEach((recuerdo) => {
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
      // Si solo hay 1 foto en todo el álbum, la descarga directa
      if (fotosParaDescargar.length === 1) {
        this.progresoDescarga.set('Descargando...');
        await this.descargarDirecto(fotosParaDescargar[0].url, fotosParaDescargar[0].nombre);
        return;
      }

      // Si hay más de 1 foto, importamos JSZip bajo demanda y creamos el ZIP completo
      const { default: JSZip } = await import('jszip');
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

      const eventoTitulo = evento?.titulo
        ? evento.titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')
        : 'Evento';
      const nombreZip = `Album_Recuerdos_${eventoTitulo}.zip`;

      this.dispararDescargaBlob(contenidoZip, nombreZip);
    } catch (error) {
      console.error('Error al generar ZIP completo:', error);
      alert('Ocurrió un error al empaquetar el ZIP del álbum.');
    } finally {
      this.descargandoTodo.set(false);
      this.progresoDescarga.set('');
    }
  }

  /**
   * Descarga directa vía fetch Blob con fallback a pestaña nueva.
   */
  async descargarDirecto(url: string, nombreArchivo: string): Promise<void> {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      this.dispararDescargaBlob(blob, nombreArchivo);
    } catch {
      window.open(url, '_blank');
    }
  }

  /**
   * Dispara la descarga del Blob en el navegador sin fugas de memoria (revokeObjectURL).
   */
  dispararDescargaBlob(blob: Blob, nombreArchivo: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = blobUrl;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
