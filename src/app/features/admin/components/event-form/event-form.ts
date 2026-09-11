import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EventService } from '../../../../core/services/eventService';
import { CalendarModule } from 'primeng/calendar';
import { TabViewModule } from 'primeng/tabview';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ImagePreviewComponent } from './image-preview.component';
import { PrimeNGConfig } from 'primeng/api';

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
  ],
  templateUrl: './event-form.html',
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

  fotoPrincipalFile: File | null = null;
  fotoCeremoniaFile: File | null = null;
  fotoRecepcionFile: File | null = null;
  galeriaFiles: File[] = [];

  eventForm = this.fb.group({
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
      this.eventForm.patchValue({ ...this.config.data });
    }
  }

  async saveEvent() {
    if (this.eventForm.invalid || this.isSaving) return;

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

      // 3. Empaquetar datos completos
      const eventData = {
        ...this.eventForm.value,
        fotoPrincipalUrl: fotoPrincipalUrl || null,
        fotoCeremoniaUrl: fotoCeremoniaUrl || null,
        fotoRecepcionUrl: fotoRecepcionUrl || null,
        galeriaUrls: galeriaUrls,
      };

      // 4. Guardar en Firestore
      if (this.isEditMode && this.eventId) {
        await this.eventService.updateEvent(this.eventId, eventData);
      } else {
        await this.eventService.createEvent({
          ...eventData,
          estaActivo: true,
        } as any);
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
}
