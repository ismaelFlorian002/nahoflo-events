import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EventService } from '../../../../core/services/event.service';
import { CalendarModule } from 'primeng/calendar';
import { TabViewModule } from 'primeng/tabview';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ImagePreviewComponent } from './image-preview.component';
import { PrimeNGConfig } from 'primeng/api';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SelectButtonModule } from 'primeng/selectbutton';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    CalendarModule,
    TabViewModule,
    InputTextareaModule,
    FileUploadModule,
    DialogModule,
    InputSwitchModule,
    SelectButtonModule,
  ],
  templateUrl: './event-form.html',
  styleUrl: './event-form.scss',
})
export class EventFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private dialogService = inject(DialogService);
  private primengConfig = inject(PrimeNGConfig);
  previewVisible = false;
  previewUrl = '';
  isEditMode = false;
  eventId?: string;

  isSaving = false; // Bandera para bloquear el botón y mostrar spinner

  // Guardar referencias a URLs existentes (en caso de edición)
  existingFotoPrincipalUrl?: string;
  existingFotoCeremoniaUrl?: string;
  existingFotoRecepcionUrl?: string;
  existingGaleriaUrls: string[] = [];

  existingMusicaFondoUrl?: string;
  musicaFondoFile: File | null = null;

  fotoPrincipalFile: File | null = null;
  fotoCeremoniaFile: File | null = null;
  fotoRecepcionFile: File | null = null;
  galeriaFiles: File[] = [];

  opcionesControlInvitados = [
    { label: 'Inactivo', value: 'inactivo' },
    { label: 'Solo Lista (Puerta)', value: 'lista_puerta' },
    { label: 'Confirmación (RSVP)', value: 'basico' },
    { label: 'Control Total VIP (QR)', value: 'total' },
  ];

  eventForm = this.fb.group({
    // Paquetes y servicios activos para este evento
    modulos: this.fb.group({
      tieneInvitacion: [true],
      tipoControlInvitados: ['basico'],
      tieneAlbum: [false],
    }),

    nombreEvento: ['', Validators.required], // <-- NUEVO: Para uso interno del panel
    pinAnfitrion: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(6)]], // <-- NUEVO

    preTitulo: [''],
    titulo: ['', Validators.required],
    enlace: ['', Validators.required],
    fecha: [null, Validators.required], // <-- Ahora guardará un objeto Date con Fecha y Hora exacta
    ceremoniaLugar: [''],
    ceremoniaUrl: [''],
    recepcionLugar: [''],
    recepcionUrl: [''],
    mensaje: [''],
    tipo: ['Boda', Validators.required],
  });

  ngOnInit() {
    this.primengConfig.setTranslation({
      firstDayOfWeek: 1,
      dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
      monthNames: [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ],
      monthNamesShort: [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ],
      today: 'Hoy',
      clear: 'Limpiar',
    });
    if (this.config.data) {
      this.isEditMode = true;
      this.eventId = this.config.data.id;
      this.existingFotoPrincipalUrl = this.config.data.fotoPrincipalUrl;
      this.existingFotoCeremoniaUrl = this.config.data.fotoCeremoniaUrl;
      this.existingFotoRecepcionUrl = this.config.data.fotoRecepcionUrl;
      this.existingGaleriaUrls = this.config.data.galeriaUrls || [];
      this.existingMusicaFondoUrl = this.config.data.musicaFondoUrl;

      // 1. Convertir fecha a Date nativo de JavaScript para que PrimeNG Calendar funcione
      let fechaDate: Date | null = null;
      if (this.config.data.fecha) {
        const f = this.config.data.fecha;
        if (typeof f.toDate === 'function') {
          fechaDate = f.toDate();
        } else if (f.seconds) {
          fechaDate = new Date(f.seconds * 1000);
        } else if (f instanceof Date) {
          fechaDate = f;
        } else {
          const d = new Date(f);
          fechaDate = isNaN(d.getTime()) ? null : d;
        }
      }

      // 2. Retrocompatibilidad para eventos existentes sin PIN o nombreEvento
      const pinRecuperado =
        this.config.data.pinAnfitrion || Math.floor(1000 + Math.random() * 9000).toString();
      const nombreRecuperado =
        this.config.data.nombreEvento || this.config.data.titulo || 'Evento';

      this.eventForm.patchValue({
        ...this.config.data,
        nombreEvento: nombreRecuperado,
        pinAnfitrion: pinRecuperado,
        fecha: fechaDate,
      });

      // Si es un evento anterior que no tenía el campo modulos, asignamos valores por defecto
      if (!this.config.data.modulos) {
        this.eventForm.patchValue({
          modulos: {
            tieneInvitacion: true,
            tipoControlInvitados: 'basico',
            tieneAlbum: false,
          },
        });
      }
    } else {
      // Para un evento nuevo, asignamos un PIN aleatorio por defecto
      this.generarPinAleatorio();
    }
  }

  async saveEvent() {
    // Si falta PIN, lo generamos de inmediato
    if (!this.eventForm.get('pinAnfitrion')?.value) {
      this.generarPinAleatorio();
    }
    // Si falta nombreEvento pero hay título, lo completamos
    const titulo = this.eventForm.get('titulo')?.value;
    if (!this.eventForm.get('nombreEvento')?.value && titulo) {
      this.eventForm.patchValue({ nombreEvento: titulo });
    }
    // Si falta enlace pero hay título, generamos el slug
    if (!this.eventForm.get('enlace')?.value && titulo) {
      const slug = titulo
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      this.eventForm.patchValue({ enlace: slug });
    }

    // Si el formulario es inválido, marcamos los campos en rojo y mostramos en consola
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      console.warn('Formulario inválido. Errores detectados:');
      Object.keys(this.eventForm.controls).forEach((key) => {
        const control = this.eventForm.get(key);
        if (control?.invalid) {
          console.warn(`Campo '${key}':`, control.errors);
        }
      });
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    try {
      // 1. Subir fotos estructurales solo si se seleccionó un archivo nuevo
      let fotoPrincipalUrl = this.existingFotoPrincipalUrl;
      if (this.fotoPrincipalFile) {
        fotoPrincipalUrl = await this.eventService.uploadImage(
          this.fotoPrincipalFile,
          'eventos/principal',
        );
      }

      let fotoCeremoniaUrl = this.existingFotoCeremoniaUrl;
      if (this.fotoCeremoniaFile) {
        fotoCeremoniaUrl = await this.eventService.uploadImage(
          this.fotoCeremoniaFile,
          'eventos/ceremonia',
        );
      }

      let fotoRecepcionUrl = this.existingFotoRecepcionUrl;
      if (this.fotoRecepcionFile) {
        fotoRecepcionUrl = await this.eventService.uploadImage(
          this.fotoRecepcionFile,
          'eventos/recepcion',
        );
      }

      // 2. Subir galería (mantiene existentes y suma las nuevas)
      let galeriaUrls = [...this.existingGaleriaUrls];
      if (this.galeriaFiles.length > 0) {
        const nuevasUrls = await this.eventService.uploadMultipleImages(
          this.galeriaFiles,
          'eventos/galeria',
        );
        galeriaUrls = [...galeriaUrls, ...nuevasUrls];
      }

      // 3. Subir música de fondo si se seleccionó una pista nueva
      let musicaFondoUrl = this.existingMusicaFondoUrl;
      if (this.musicaFondoFile) {
        musicaFondoUrl = await this.eventService.uploadImage(
          this.musicaFondoFile,
          'eventos/musica',
        );
      }

      // 4. Empaquetar datos limpios (0 valores undefined para evitar errores de Firestore)
      const formVal = this.eventForm.value;
      const eventData: any = {
        nombreEvento: formVal.nombreEvento || '',
        pinAnfitrion: formVal.pinAnfitrion || '',
        preTitulo: formVal.preTitulo || '',
        titulo: formVal.titulo || '',
        enlace: formVal.enlace || '',
        fecha: formVal.fecha || new Date(),
        tipo: formVal.tipo || 'Boda',
        mensaje: formVal.mensaje || '',
        ceremoniaLugar: formVal.ceremoniaLugar || '',
        ceremoniaUrl: formVal.ceremoniaUrl || '',
        recepcionLugar: formVal.recepcionLugar || '',
        recepcionUrl: formVal.recepcionUrl || '',
        modulos: formVal.modulos || {
          tieneInvitacion: true,
          tipoControlInvitados: 'basico',
          tieneAlbum: false,
        },
        fotoPrincipalUrl: fotoPrincipalUrl || null,
        fotoCeremoniaUrl: fotoCeremoniaUrl || null,
        fotoRecepcionUrl: fotoRecepcionUrl || null,
        galeriaUrls: galeriaUrls || [],
        musicaFondoUrl: musicaFondoUrl || null,
      };

      // 5. Guardar en Firestore
      if (this.isEditMode && this.eventId) {
        await this.eventService.updateEvent(this.eventId, eventData);
      } else {
        await this.eventService.createEvent({
          ...eventData,
          estaActivo: true,
        });
      }

      this.ref.close(true);
    } catch (error) {
      console.error('Error guardando evento:', error);
    } finally {
      this.isSaving = false;
    }
  }

  onEstructuralSelected(event: any, tipoFoto: 'principal' | 'ceremonia' | 'recepcion') {
    const file = event.files[0];
    if (file) {
      if (tipoFoto === 'principal') this.fotoPrincipalFile = file;
      if (tipoFoto === 'ceremonia') this.fotoCeremoniaFile = file;
      if (tipoFoto === 'recepcion') this.fotoRecepcionFile = file;
    }
  }

  onGaleriaSelected(event: any) {
    // PrimeNG expone currentFiles (Array) o files (FileList). Array.from asegura compatibilidad total
    const seleccionados = event.currentFiles || event.files || [];
    this.galeriaFiles = Array.from(seleccionados);
  }

  previewImage(file: File) {
    const url = URL.createObjectURL(file);
    this.dialogService.open(ImagePreviewComponent, {
      header: 'Previsualización',
      data: { url: url },
      width: 'auto',
      dismissableMask: true,
      modal: true,
      // Te dejo esto aquí, ayuda nativamente a que PrimeNG no se vuelva loco
      focusOnShow: false,
    });
  }

  removeEstructuralFile(tipo: 'principal' | 'ceremonia' | 'recepcion') {
    if (tipo === 'principal') this.fotoPrincipalFile = null;
    if (tipo === 'ceremonia') this.fotoCeremoniaFile = null;
    if (tipo === 'recepcion') this.fotoRecepcionFile = null;
  }

  // NUEVA FUNCIÓN ABSOLUTA PARA BORRAR DE LA GALERÍA
  removeGaleriaFoto(event: Event, file: File, uploader: any) {
    // 1. Matamos cualquier submit falso
    event.preventDefault();

    // 2. Buscamos el archivo exacto en el componente de PrimeNG y lo forzamos a borrarse
    const index = uploader.files.indexOf(file);
    if (index !== -1) {
      uploader.remove(event, index);
    }

    // 3. Lo borramos de nuestra propia variable para estar sincronizados
    this.galeriaFiles = this.galeriaFiles.filter((f) => f !== file);
  }

  // Genera un código PIN aleatorio de 4 dígitos (ej: 4821)
  generarPinAleatorio() {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    this.eventForm.patchValue({ pinAnfitrion: pin });
  }

  // Previsualizar una foto que ya es una URL de Firebase
  previewExistingUrl(url: string) {
    this.dialogService.open(ImagePreviewComponent, {
      header: 'Foto Guardada',
      data: { url: url },
      width: 'auto',
      dismissableMask: true,
      modal: true,
      focusOnShow: false,
    });
  }

  // Eliminar una foto estructural guardada (ceremonia, recepción o principal)
  removeExistingFoto(tipo: 'principal' | 'ceremonia' | 'recepcion') {
    if (tipo === 'principal') this.existingFotoPrincipalUrl = undefined;
    if (tipo === 'ceremonia') this.existingFotoCeremoniaUrl = undefined;
    if (tipo === 'recepcion') this.existingFotoRecepcionUrl = undefined;
  }

  // Eliminar una foto específica de la galería guardada
  removeExistingGaleriaFoto(url: string) {
    this.existingGaleriaUrls = this.existingGaleriaUrls.filter((u) => u !== url);
  }

  onMusicaSelected(event: any) {
    const file = event.files[0];
    if (file) {
      this.musicaFondoFile = file;
    }
  }

  removeMusicaFile() {
    this.musicaFondoFile = null;
  }

  removeExistingMusica() {
    this.existingMusicaFondoUrl = undefined;
  }

  // Permite saber en el HTML si debemos mostrar las pestañas de la invitación
  get tieneInvitacionActiva(): boolean {
    return this.eventForm.get('modulos.tieneInvitacion')?.value ?? true;
  }
}
