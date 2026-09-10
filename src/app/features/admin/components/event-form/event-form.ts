import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef, DynamicDialogConfig, DialogService } from 'primeng/dynamicdialog';
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

  fotoPrincipalFile: File | null = null;
  fotoCeremoniaFile: File | null = null;
  fotoRecepcionFile: File | null = null;
  galeriaFiles: File[] = [];

  eventForm = this.fb.group({
    nombreEvento: ['', Validators.required], // <-- NUEVO: Para uso interno del panel
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
      this.eventForm.patchValue({ ...this.config.data });
    }
  }

  async saveEvent() {
    if (this.eventForm.valid) {
      try {
        if (this.isEditMode && this.eventId) {
          await this.eventService.updateEvent(this.eventId, this.eventForm.value);
        } else {
          const newEvent = { ...this.eventForm.value, estaActivo: true };
          await this.eventService.createEvent(newEvent as any);
        }
        this.ref.close(true);
      } catch (error) {
        console.error('Error guardando evento:', error);
      }
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
    this.galeriaFiles = event.files;
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
}
