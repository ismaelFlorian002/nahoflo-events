import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Evento, PlantillaWhatsapp } from '../../../../core/models/event.model';
import { InvitadoModel } from '../../../../core/models/invitado.model';
import { copiarAlPortapapeles } from '../../../../core/utils/clipboard.util';

@Component({
  selector: 'app-whatsapp-messaging-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TooltipModule,
  ],
  templateUrl: './whatsapp-messaging-center.component.html',
  styleUrl: './whatsapp-messaging-center.component.scss',
})
export class WhatsappMessagingCenterComponent implements OnInit {
  @Input({ required: true }) evento!: Evento;
  @Input() invitados: InvitadoModel[] = [];

  private messageService = inject(MessageService);

  plantillasPredefinidas: PlantillaWhatsapp[] = [
    {
      id: 'invitacion_inicial',
      titulo: '🎉 1. Invitación & RSVP Inicial',
      categoria: 'invitacion',
      mensaje: `¡Hola [Nombre del Invitado]! 🎉\n\nTe invitamos con mucho cariño a *[Nombre del Evento]*.\n\n🎟️ Tienes asignados: *[Cantidad de Pases]*.\n\n📲 Por favor confirma tu asistencia y consulta los detalles aquí:\n[Enlace al Pase VIP]\n\n¡Esperamos de corazón contar con tu presencia! ✨`,
    },
    {
      id: 'recordatorio_pendiente',
      titulo: '⏳ 2. Recordatorio para Pendientes',
      categoria: 'recordatorio',
      mensaje: `¡Hola [Nombre del Invitado]! ✨\n\nTe recordamos confirmar tu asistencia para *[Nombre del Evento]*.\n\n🎟️ Pases reservados: *[Cantidad de Pases]*\n\n📲 Ingresa a tu invitación y confirma tu respuesta aquí:\n[Enlace al Pase VIP]\n\n¡Queremos asegurar tu lugar en nuestra celebración! 🥂`,
    },
    {
      id: 'pase_vip_qr',
      titulo: '🎟️ 3. Pase VIP Digital & Código QR',
      categoria: 'pase_qr',
      mensaje: `¡Hola [Nombre del Invitado]! 🎟️\n\nTu *Pase Digital VIP* para *[Nombre del Evento]* ya está listo.\n\n📍 Acceso autorizado: *[Cantidad de Pases]*\n🪑 Mesa: *[Mesa Asignada]*\n\n📲 Muestra tu código QR en la recepción al ingresar desde este enlace:\n[Enlace al Pase VIP]\n\n¡Nos vemos muy pronto para celebrar! 🎉`,
    },
    {
      id: 'indicaciones_24h',
      titulo: '📍 4. Indicaciones del Salón (24h Antes)',
      categoria: 'dia_evento',
      mensaje: `¡Mañana es el gran día! 🎉\n\nTe compartimos la información clave para *[Nombre del Evento]*:\n\n📅 Fecha: [Fecha del Evento]\n📍 Lugar: [Lugar del Salón]\n🪑 Tu Mesa: *[Mesa Asignada]*\n🍽️ Tu Menú: [Menú Seleccionado]\n\n📲 Abre tu mapa de ubicación y pase digital aquí:\n[Enlace al Pase VIP]\n\n¡Llega con tiempo y disfrutemos al máximo! ✨`,
    },
    {
      id: 'agradecimiento_post',
      titulo: '❤️ 5. Agradecimiento & Muro de Fotos',
      categoria: 'post_evento',
      mensaje: `¡Muchas gracias por acompañarnos en *[Nombre del Evento]*! ❤️\n\nFue un día inolvidable y fue maravilloso compartirlo contigo.\n\n📸 Ya puedes ver y subir tus fotos del evento en nuestro álbum digital:\n[Enlace al Álbum]\n\n¡Un fuerte abrazo! 🎉`,
    },
  ];

  camposInteligentes = [
    { etiqueta: '[Nombre del Invitado]', icono: 'pi pi-user', desc: 'Se reemplaza automáticamente por el nombre del invitado' },
    { etiqueta: '[Cantidad de Pases]', icono: 'pi pi-ticket', desc: 'Se reemplaza por la cantidad de pases (ej. 2 pases)' },
    { etiqueta: '[Mesa Asignada]', icono: 'pi pi-th-large', desc: 'Se reemplaza por el número de mesa (ej. Mesa 1)' },
    { etiqueta: '[Menú Seleccionado]', icono: 'pi pi-verified', desc: 'Se reemplaza por el tipo de menú' },
    { etiqueta: '[Enlace al Pase VIP]', icono: 'pi pi-link', desc: 'Se reemplaza por el enlace al pase digital con QR' },
    { etiqueta: '[Nombre del Evento]', icono: 'pi pi-star', desc: 'Se reemplaza por el nombre de la boda / evento' },
    { etiqueta: '[Fecha del Evento]', icono: 'pi pi-calendar', desc: 'Se reemplaza por la fecha y hora' },
    { etiqueta: '[Lugar del Salón]', icono: 'pi pi-map-marker', desc: 'Se reemplaza por la dirección del evento' },
    { etiqueta: '[Enlace al Álbum]', icono: 'pi pi-camera', desc: 'Se reemplaza por el enlace al álbum digital' },
  ];

  plantillaSeleccionadaId = signal<string>('invitacion_inicial');
  mensajeTexto = signal<string>('');
  filtroEstado = signal<'todos' | 'pendiente' | 'confirmado' | 'sin_mesa'>('todos');
  busqueda = signal<string>('');
  invitadoPreviewId = signal<string | null>(null);

  ngOnInit(): void {
    const inicial = this.plantillasPredefinidas[0];
    this.mensajeTexto.set(inicial.mensaje);
    if (this.invitados.length > 0) {
      this.invitadoPreviewId.set(this.invitados[0].id || null);
    }
  }

  alCambiarPlantilla(plantillaId: string): void {
    const encontrada = this.plantillasPredefinidas.find((p) => p.id === plantillaId);
    if (encontrada) {
      this.plantillaSeleccionadaId.set(plantillaId);
      this.mensajeTexto.set(encontrada.mensaje);
    }
  }

  insertarCampo(campo: string): void {
    const actual = this.mensajeTexto();
    this.mensajeTexto.set(actual + ' ' + campo);
  }

  invitadoParaPreview = computed(() => {
    const id = this.invitadoPreviewId();
    if (id) {
      const inv = this.invitados.find((i) => i.id === id);
      if (inv) return inv;
    }
    return this.invitados.length > 0
      ? this.invitados[0]
      : ({
          nombre: 'Familia Pérez',
          pasesConfirmados: 2,
          mesa: 'Mesa 1',
          tipoMenu: 'Adulto',
          estado: 'confirmado',
        } as InvitadoModel);
  });

  mensajeProcesadoPreview = computed(() => {
    return this.procesarPlantilla(this.mensajeTexto(), this.invitadoParaPreview());
  });

  invitadosFiltrados = computed(() => {
    const term = this.busqueda().trim().toLowerCase();
    const filtro = this.filtroEstado();

    return this.invitados.filter((inv) => {
      const coincideNombre = !term || (inv.nombre || '').toLowerCase().includes(term);

      let coincideEstado = true;
      if (filtro === 'pendiente') {
        coincideEstado = inv.estado === 'pendiente';
      } else if (filtro === 'confirmado') {
        coincideEstado = inv.estado === 'confirmado' || inv.asistira;
      } else if (filtro === 'sin_mesa') {
        coincideEstado = !inv.mesa || inv.mesa.trim() === '';
      }

      return coincideNombre && coincideEstado;
    });
  });

  procesarPlantilla(plantilla: string, invitado?: InvitadoModel): string {
    if (!plantilla) return '';

    const ev = this.evento;
    const inv: Partial<InvitadoModel> = invitado || {
      id: 'demo',
      nombre: 'Invitado(a)',
      pasesConfirmados: 1,
      mesa: 'Mesa Novios',
      tipoMenu: 'Adulto',
    };

    const nombreEvento = ev.preTitulo ? `${ev.preTitulo} · ${ev.titulo}` : ev.titulo || 'Nuestra Boda';
    const pases = inv.pasesConfirmados || 1;
    const pasesTexto = pases === 1 ? '1 pase' : `${pases} pases`;
    const mesa = inv.mesa || 'Por asignar';
    const tipoMenu = inv.tipoMenu || 'Estándar';

    const origin = window.location.origin;
    const urlPase = inv.id ? `${origin}/e/${ev.enlace}?pase=${inv.id}` : `${origin}/e/${ev.enlace}`;
    const urlAlbum = `${origin}/e/${ev.enlace}/album`;

    let fechaFormateada = '-';
    if (ev.fecha) {
      const d = (ev.fecha as any)?.toDate ? (ev.fecha as any).toDate() : new Date(ev.fecha);
      if (!isNaN(d.getTime())) {
        fechaFormateada = d.toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    const lugarRecepcion = ev.recepcionLugar || 'Salón Principal';

    return plantilla
      // Soporta tanto etiquetas amigables en español [Nombre del Invitado] como tokens de sistema {{nombre}}
      .replace(/\[Nombre del Invitado\]|\{\{nombre\}\}/g, inv.nombre || 'Invitado(a)')
      .replace(/\[Cantidad de Pases\]|\{\{pases\}\}/g, pasesTexto)
      .replace(/\[Mesa Asignada\]|\{\{mesa\}\}/g, mesa)
      .replace(/\[Menú Seleccionado\]|\{\{tipoMenu\}\}/g, tipoMenu)
      .replace(/\[Enlace al Pase VIP\]|\{\{urlPase\}\}/g, urlPase)
      .replace(/\[Nombre del Evento\]|\{\{nombreEvento\}\}/g, nombreEvento)
      .replace(/\[Fecha del Evento\]|\{\{fechaEvento\}\}/g, fechaFormateada)
      .replace(/\[Lugar del Salón\]|\{\{lugarRecepcion\}\}/g, lugarRecepcion)
      .replace(/\[Enlace al Álbum\]|\{\{urlAlbum\}\}/g, urlAlbum);
  }

  lanzarWhatsApp(invitado: InvitadoModel): void {
    const textoFinal = this.procesarPlantilla(this.mensajeTexto(), invitado);
    const telefonoLimpio = (invitado.telefono || '').replace(/\D/g, '');

    const urlWa =
      telefonoLimpio && telefonoLimpio.length >= 10
        ? `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(textoFinal)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(textoFinal)}`;

    window.open(urlWa, '_blank');
  }

  async copiarTextoProcesado(): Promise<void> {
    const texto = this.mensajeProcesadoPreview();
    await copiarAlPortapapeles(texto);
    this.messageService.add({
      severity: 'success',
      summary: 'Mensaje Copiado',
      detail: 'El mensaje personalizado ha sido copiado al portapapeles.',
    });
  }
}
