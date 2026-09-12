import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EventService } from '../../core/services/event.service';
import { Evento } from '../../core/models/event.model';
import { InvitadoModel } from '../../core/models/invitado.model';
import { RecuerdoModel } from '../../core/models/RecuerdoModel';
import JSZip from 'jszip';
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
  ],
  templateUrl: './anfitrion-asistencias.component.html',
  styleUrl: './anfitrion-asistencias.component.scss',
})
export class AnfitrionAsistenciasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);

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
  pestanaActiva = signal<'invitados' | 'album'>('invitados');

  // Recuerdos del álbum colaborativo
  recuerdos = signal<RecuerdoModel[]>([]);
  eliminandoId = signal<string | null>(null);

  // Métricas
  totalPases = signal<number>(0);
  totalConfirmados = signal<number>(0);
  totalCancelados = signal<number>(0);

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
        // Si ya había ingresado el PIN en esta sesión, lo recordamos
        const pinSesion = sessionStorage.getItem(`pin_${ev.id}`);
        if (pinSesion && pinSesion === ev.pinAnfitrion) {
          this.pinDesbloqueado.set(true);
          await Promise.all([this.cargarInvitados(ev.id!), this.cargarRecuerdos(ev.id!)]);
          await this.cargarInvitados(ev.id!);
        }
      } else {
        this.notFound.set(true);
      }
    } catch (error) {
      console.error('Error al cargar evento:', error);
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
      await this.cargarInvitados(ev.id);
    } else {
      this.errorPin.set(true);
    }
    await Promise.all([this.cargarInvitados(ev.id), this.cargarRecuerdos(ev.id)]);
  }

  async cargarInvitados(eventoId: string) {
    this.cargando.set(true);
    try {
      const lista = await this.eventService.getInvitados(eventoId);
      this.invitados.set(lista);

      // Calcular KPIs
      const pases = lista
        .filter((i) => i.asistira)
        .reduce((sum, i) => sum + (Number(i.pasesConfirmados) || 0), 0);
      const confirmados = lista.filter((i) => i.asistira).length;
      const cancelados = lista.filter((i) => !i.asistira).length;

      this.totalPases.set(pases);
      this.totalConfirmados.set(confirmados);
      this.totalCancelados.set(cancelados);
    } catch (error) {
      console.error('Error cargando invitados:', error);
    } finally {
      this.cargando.set(false);
    }
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
}
