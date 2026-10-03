import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EventService } from '../../../../core/services/event.service';
import { DatePickerModule } from 'primeng/datepicker';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ImagePreviewComponent } from './image-preview.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ClienteService } from '../../../../core/services/cliente.service';
import { ClienteModel } from '../../../../core/models/cliente.model';
import { FloatLabelModule } from 'primeng/floatlabel';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { firstValueFrom } from 'rxjs';
import { ColorSugerido, DressCode, ItemItinerario, MesaRegalos } from '../../../../core/models/event.model';
import {
  COLORES_EVITAR_RAPIDOS,
  ESTILOS_VESTIMENTA,
  PALETAS_COLORES,
  PaletaColores,
  dressCodeVacio,
} from '../../../../core/data/dress-code';
import {
  TIENDAS_REGALOS,
  bancoDesdeClabe,
  clabeValida,
  mesaRegalosVacia,
  soloDigitos,
} from '../../../../core/data/mesa-regalos';
import {
  ICONOS_ITINERARIO,
  PLANTILLAS_ITINERARIO,
  PlantillaItinerario,
  construirItinerario,
  nuevoIdItinerario,
  ordenarItinerario,
  plantillaSugerida,
} from '../../../../core/data/plantillas-itinerario';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DatePickerModule,
    TabsModule,
    TextareaModule,
    FileUploadModule,
    DialogModule,
    ToggleSwitchModule,
    SelectModule,
    TooltipModule,
    FloatLabelModule,
    FormsModule,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnInit {
  private fb             = inject(FormBuilder);
  private eventService   = inject(EventService);
  private clienteService = inject(ClienteService);
  private usuarioService = inject(UsuarioService);
  public  ref    = inject(DynamicDialogRef);
  public  config = inject(DynamicDialogConfig);
  private dialogService    = inject(DialogService);
  private primeng          = inject(PrimeNG);
  private confirmationService = inject(ConfirmationService);
  // Los callbacks del p-confirmdialog global no refrescan la vista de este diálogo dinámico (app zoneless)
  private cdr = inject(ChangeDetectorRef);
  private messageService      = inject(MessageService);
  previewVisible = false;
  previewUrl = '';
  isEditMode = false;
  eventId?: string;

  isSaving = false; // Bandera para bloquear el botón y mostrar spinner

  cargandoPin = signal(false);
  /** PIN guardado al abrir el formulario; los de 4 dígitos se aceptan mientras no se cambien. */
  private pinOriginal: string | null = null;

  // Estado del catálogo de clientes
  clientes: ClienteModel[] = [];
  cargandoClientes = false;
  clienteSeleccionado: ClienteModel | null = null;

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

  // Itinerario público (opcional)
  mostrarItinerario = false;
  plantillaAplicada: string | null = null;
  itinerario: ItemItinerario[] = [];
  readonly plantillasItinerario = PLANTILLAS_ITINERARIO;
  readonly iconosItinerario = ICONOS_ITINERARIO;

  // Mesa de regalos (opcional)
  mesaRegalos: MesaRegalos = mesaRegalosVacia();
  readonly tiendasCatalogo = TIENDAS_REGALOS;

  // Código de vestimenta (opcional)
  dressCode: DressCode = dressCodeVacio();
  readonly estilosVestimenta = ESTILOS_VESTIMENTA;
  readonly paletasColores = PALETAS_COLORES;
  readonly coloresEvitarRapidos = COLORES_EVITAR_RAPIDOS;
  nuevoColorHex = '#c9a227';
  nuevoColorNombre = '';

  opcionesControlInvitados = [
    { label: 'Inactivo', value: 'inactivo', icono: 'pi pi-ban', descripcion: 'Sin lista de invitados' },
    { label: 'Solo Lista (Puerta)', value: 'lista_puerta', icono: 'pi pi-list-check', descripcion: 'Registro de llegada en puerta' },
    { label: 'Confirmación (RSVP)', value: 'basico', icono: 'pi pi-envelope', descripcion: 'Los invitados confirman asistencia' },
    { label: 'Control Total VIP (QR)', value: 'total', icono: 'pi pi-qrcode', descripcion: 'Pases con QR y escáner en recepción' },
  ];

  modulosDisponibles = [
    { control: 'tieneInvitacion', titulo: 'Invitación web', descripcion: 'Página pública del evento (/e/:slug)', icono: 'pi pi-globe' },
    { control: 'tieneAlbum', titulo: 'Álbum digital en mesas', descripcion: 'Los invitados suben fotos con un QR', icono: 'pi pi-camera' },
    { control: 'tienePlannerSuite', titulo: 'Suite de Wedding Planner', descripcion: 'Cronograma, presupuesto, proveedores y checklist', icono: 'pi pi-briefcase' },
    { control: 'permiteMarcaBlanca', titulo: 'Marca blanca de agencia', descripcion: 'Branding de la agencia y dossier en PDF', icono: 'pi pi-palette' },
  ];

  eventForm = this.fb.group({
    // Paquetes y servicios activos para este evento
    modulos: this.fb.group({
      tieneInvitacion: [true],
      tipoControlInvitados: ['basico'],
      tieneAlbum: [false],
      tienePlannerSuite: [true],
      permiteMarcaBlanca: [true],
    }),

    nombreEvento: ['', Validators.required], // <-- NUEVO: Para uso interno del panel
    pinAnfitrion: ['', [Validators.required, (c: AbstractControl) => this.validarPin(c)]],

    // Datos del Cliente / Contacto responsable
    clienteId: [null as string | null],
    contactoNombre: [''],
    contactoTelefono: [''],
    contactoEmail: [''],
    contactoNotas: [''],
    guardarEnCatalogo: [true],

    preTitulo: [''],
    titulo: ['', Validators.required],
    enlace: ['', Validators.required],
    fecha: [null, Validators.required], // <-- Ahora guardará un objeto Date con Fecha y Hora exacta
    ceremoniaLugar: [''],
    ceremoniaDireccion: [''],
    ceremoniaUrl: [''],
    recepcionLugar: [''],
    recepcionDireccion: [''],
    recepcionUrl: [''],
    mensaje: [''],
    tipo: ['Boda', Validators.required],
  });

  ngOnInit() {
    this.primeng.setTranslation({
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
      this.mostrarItinerario = !!this.config.data.mostrarItinerario;
      this.itinerario = (this.config.data.itinerario || []).map((i: ItemItinerario) => ({ ...i }));
      this.plantillaAplicada = this.itinerario.length ? this.config.data.plantillaItinerario ?? null : null;
      if (this.config.data.mesaRegalos) {
        const base = mesaRegalosVacia();
        const guardada: MesaRegalos = this.config.data.mesaRegalos;
        this.mesaRegalos = {
          ...base,
          ...guardada,
          tiendas: (guardada.tiendas || []).map((t) => ({ ...t })),
          sobres: { ...base.sobres, ...guardada.sobres },
          transferencia: { ...base.transferencia, ...guardada.transferencia },
        };
      }
      if (this.config.data.dressCode) {
        const guardado: DressCode = this.config.data.dressCode;
        this.dressCode = {
          ...dressCodeVacio(),
          ...guardado,
          colores: (guardado.colores || []).map((c) => ({ ...c })),
          coloresEvitar: (guardado.coloresEvitar || []).map((c) => ({ ...c })),
        };
      }

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

      // 2. Retrocompatibilidad para eventos existentes sin nombreEvento
      const nombreRecuperado = this.config.data.nombreEvento || this.config.data.titulo || 'Evento';

      const clienteIdExistente = this.config.data.clienteId || null;
      const contactoNombre = this.config.data.contactoNombre || '';
      const contactoTelefono = this.config.data.contactoTelefono || '';
      const contactoEmail = this.config.data.contactoEmail || '';
      const contactoNotas = this.config.data.contactoNotas || '';

      this.eventForm.patchValue({
        ...this.config.data,
        nombreEvento: nombreRecuperado,
        pinAnfitrion: '',
        fecha: fechaDate,
        clienteId: clienteIdExistente,
        contactoNombre: contactoNombre,
        contactoTelefono: contactoTelefono,
        contactoEmail: contactoEmail,
        contactoNotas: contactoNotas,
        guardarEnCatalogo: false,
      });

      // Si es un evento anterior que no tenía el campo modulos, asignamos valores por defecto
      if (!this.config.data.modulos) {
        this.eventForm.patchValue({
          modulos: {
            tieneInvitacion: true,
            tipoControlInvitados: 'basico',
            tieneAlbum: false,
            tienePlannerSuite: true,
            permiteMarcaBlanca: true,
          },
        });
      }

      void this.cargarPin(this.config.data.id, this.config.data.pinAnfitrion);
    } else {
      // Para un evento nuevo, asignamos un PIN aleatorio por defecto
      this.generarPinAleatorio();
    }

    // Cargar clientes existentes del catálogo
    this.cargarClientes();
  }

  /** Lee el PIN de privado/acceso; los eventos sin migrar aún lo traen en el documento público. */
  private async cargarPin(eventoId: string | undefined, pinPublico?: string) {
    this.cargandoPin.set(true);
    try {
      const pin = (eventoId ? await this.eventService.getPinAnfitrion(eventoId) : null) || pinPublico || null;
      this.pinOriginal = pin;
      if (pin) this.eventForm.patchValue({ pinAnfitrion: pin });
      else this.generarPinAleatorio();
    } catch (error) {
      console.error('No se pudo leer el PIN del anfitrión:', error);
      this.pinOriginal = pinPublico || null;
      if (pinPublico) this.eventForm.patchValue({ pinAnfitrion: pinPublico });
    } finally {
      this.cargandoPin.set(false);
    }
  }

  private validarPin(control: AbstractControl): ValidationErrors | null {
    const pin = String(control.value ?? '');
    if (!pin) return null;
    if (/^\d{6}$/.test(pin)) return null;
    if (pin === this.pinOriginal && /^\d{4,6}$/.test(pin)) return null;
    return { pin: true };
  }

  saveEvent() {
    if (this.cargandoPin()) return;
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
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor completa los campos obligatorios.',
      });
      return;
    }

    if (this.isSaving) return;

    const header = this.isEditMode ? 'Confirmar Guardado' : 'Confirmar Nuevo Evento';
    const message = this.isEditMode
      ? `¿Deseas guardar las modificaciones realizadas en "${titulo}"?`
      : `¿Deseas crear y publicar el nuevo evento "${titulo}"?`;

    this.confirmationService.confirm({
      header,
      message,
      icon: 'pi pi-question-circle text-gold-500',
      acceptLabel: this.isEditMode ? 'Guardar Cambios' : 'Crear Evento',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm bg-gold-500 hover:bg-gold-600 text-white border-0',
      rejectButtonStyleClass: 'p-button-sm p-button-secondary p-button-outlined',
      accept: async () => {
        await this.ejecutarGuardadoEvento();
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se realizaron cambios en el evento.',
        });
      },
    });
  }

  private async ejecutarGuardadoEvento() {
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
      let clienteIdFinal = formVal.clienteId || null;

      // Si el usuario activó guardar en catálogo y no hay cliente seleccionado aún, pero escribió un nombre
      if (formVal.guardarEnCatalogo && !clienteIdFinal && formVal.contactoNombre?.trim()) {
        try {
          clienteIdFinal = await this.clienteService.createCliente({
            nombreCompleto: formVal.contactoNombre.trim(),
            telefono: formVal.contactoTelefono?.trim() || '',
            email: formVal.contactoEmail?.trim() || '',
            notas: formVal.contactoNotas?.trim() || '',
            totalEventos: 1,
            creadoEn: new Date(),
          });
        } catch (err) {
          console.error('Error al registrar nuevo cliente en catálogo:', err);
        }
      } else if (clienteIdFinal && !this.isEditMode) {
        // Si se seleccionó un cliente existente para un nuevo evento, incrementamos su contador
        try {
          await this.clienteService.incrementarTotalEventos(clienteIdFinal);
        } catch (err) {
          console.error('Error al actualizar contador del cliente:', err);
        }
      }

      const eventData: any = {
        nombreEvento: formVal.nombreEvento || '',
        clienteId: clienteIdFinal || null,
        contactoNombre: formVal.contactoNombre?.trim() || '',
        contactoTelefono: formVal.contactoTelefono?.trim() || '',
        contactoEmail: formVal.contactoEmail?.trim() || '',
        contactoNotas: formVal.contactoNotas?.trim() || '',
        preTitulo: formVal.preTitulo || '',
        titulo: formVal.titulo || '',
        enlace: formVal.enlace || '',
        fecha: formVal.fecha || new Date(),
        tipo: formVal.tipo || 'Boda',
        mensaje: formVal.mensaje || '',
        ceremoniaLugar: formVal.ceremoniaLugar || '',
        ceremoniaDireccion: formVal.ceremoniaDireccion?.trim() || '',
        ceremoniaUrl: formVal.ceremoniaUrl || '',
        recepcionLugar: formVal.recepcionLugar || '',
        recepcionDireccion: formVal.recepcionDireccion?.trim() || '',
        recepcionUrl: formVal.recepcionUrl || '',
        modulos: formVal.modulos || {
          tieneInvitacion: true,
          tipoControlInvitados: 'basico',
          tieneAlbum: false,
          tienePlannerSuite: true,
          permiteMarcaBlanca: true,
        },
        fotoPrincipalUrl: fotoPrincipalUrl || null,
        fotoCeremoniaUrl: fotoCeremoniaUrl || null,
        fotoRecepcionUrl: fotoRecepcionUrl || null,
        galeriaUrls: galeriaUrls || [],
        musicaFondoUrl: musicaFondoUrl || null,
        mostrarItinerario: this.mostrarItinerario && this.itinerarioLimpio().length > 0,
        itinerario: this.itinerarioLimpio(),
        plantillaItinerario: this.itinerarioLimpio().length ? this.plantillaAplicada : null,
        mesaRegalos: this.mesaRegalosLimpia(),
        dressCode: this.dressCodeLimpio(),
      };

      // 5. Guardar en Firestore (el PIN va aparte, en privado/acceso)
      const pin = formVal.pinAnfitrion || '';
      if (this.isEditMode && this.eventId) {
        await this.eventService.updateEvent(this.eventId, eventData);
        await this.eventService.guardarPinAnfitrion(this.eventId, pin);
        this.messageService.add({
          severity: 'success',
          summary: 'Evento Actualizado',
          detail: `Los cambios en "${formVal.titulo}" fueron guardados correctamente.`,
        });
      } else {
        const nuevo = await this.eventService.createEvent({
          ...eventData,
          estaActivo: true,
        });
        await this.eventService.guardarPinAnfitrion(nuevo.id, pin);
        this.messageService.add({
          severity: 'success',
          summary: 'Evento Creado',
          detail: `El evento "${formVal.titulo}" ha sido creado y publicado.`,
        });
      }

      this.ref.close(true);
    } catch (error) {
      console.error('Error guardando evento:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un problema al guardar el evento. Intenta nuevamente.',
      });
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

  generarPinAleatorio() {
    const [valor] = crypto.getRandomValues(new Uint32Array(1));
    const pin = String(valor % 1_000_000).padStart(6, '0');
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

  // ─── Itinerario ───────────────────────────────────────────────────────────

  get plantillaRecomendada(): string {
    return plantillaSugerida(`${this.eventForm.get('preTitulo')?.value || ''} ${this.eventForm.get('tipo')?.value || ''}`);
  }

  /** Hora de inicio del evento ("HH:mm") tomada de la fecha capturada en Básico. */
  private get horaInicioEvento(): string {
    const fecha = this.eventForm.get('fecha')?.value as Date | null;
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '17:00';
    return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  }

  aplicarPlantillaItinerario(plantilla: PlantillaItinerario): void {
    const aplicar = () => {
      this.itinerario = construirItinerario(plantilla, this.horaInicioEvento);
      this.plantillaAplicada = plantilla.id;
      this.mostrarItinerario = true;
      this.cdr.markForCheck();
    };

    if (!this.itinerario.length) {
      aplicar();
      return;
    }

    this.confirmationService.confirm({
      header: 'Reemplazar itinerario',
      message: `Se reemplazarán los ${this.itinerario.length} momentos actuales por la plantilla "${plantilla.nombre}". ¿Continuar?`,
      icon: 'pi pi-exclamation-triangle text-amber-500',
      acceptLabel: 'Reemplazar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm bg-gold-500 hover:bg-gold-600 text-white border-0',
      rejectButtonStyleClass: 'p-button-sm p-button-secondary p-button-outlined',
      accept: aplicar,
    });
  }

  agregarMomentoItinerario(): void {
    const ultimo = this.itinerario[this.itinerario.length - 1];
    let hora = this.horaInicioEvento;
    if (ultimo?.hora) {
      const [h, m] = ultimo.hora.split(':').map(Number);
      const total = (h * 60 + m + 60) % (24 * 60);
      hora = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    this.itinerario = [...this.itinerario, { id: nuevoIdItinerario(), hora, titulo: '', descripcion: '', icono: 'pi-star' }];
  }

  quitarMomentoItinerario(id: string): void {
    this.itinerario = this.itinerario.filter((i) => i.id !== id);
    if (!this.itinerario.length) this.plantillaAplicada = null;
  }

  ordenarItinerarioPorHora(): void {
    this.itinerario = ordenarItinerario(this.itinerario, this.horaInicioEvento);
  }

  limpiarItinerario(): void {
    this.confirmationService.confirm({
      header: 'Vaciar itinerario',
      message: '¿Quieres quitar todos los momentos del itinerario?',
      icon: 'pi pi-exclamation-triangle text-amber-500',
      acceptLabel: 'Vaciar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm p-button-danger',
      rejectButtonStyleClass: 'p-button-sm p-button-secondary p-button-outlined',
      accept: () => {
        this.itinerario = [];
        this.plantillaAplicada = null;
        this.cdr.markForCheck();
      },
    });
  }

  /** Momentos con título, sin espacios sobrantes y ordenados por hora. */
  private itinerarioLimpio(): ItemItinerario[] {
    const limpios = this.itinerario
      .filter((i) => i.titulo.trim() && i.hora)
      .map((i) => ({
        id: i.id,
        hora: i.hora,
        titulo: i.titulo.trim(),
        descripcion: i.descripcion?.trim() || '',
        icono: i.icono || 'pi-star',
      }));
    return ordenarItinerario(limpios, this.horaInicioEvento);
  }

  // ─── Mesa de regalos ──────────────────────────────────────────────────────

  agregarTiendaRegalos(): void {
    const usadas = new Set(this.mesaRegalos.tiendas.map((t) => t.tienda));
    const siguiente = this.tiendasCatalogo.find((t) => t.id !== 'otra' && !usadas.has(t.id)) || this.tiendasCatalogo[0];
    this.mesaRegalos.tiendas = [
      ...this.mesaRegalos.tiendas,
      { id: nuevoIdItinerario(), tienda: siguiente.id, nombre: siguiente.nombre, numeroEvento: '', url: '' },
    ];
  }

  quitarTiendaRegalos(id: string): void {
    this.mesaRegalos.tiendas = this.mesaRegalos.tiendas.filter((t) => t.id !== id);
  }

  cambiarTiendaRegalos(tiendaId: string, index: number): void {
    const tienda = this.mesaRegalos.tiendas[index];
    const catalogo = this.tiendasCatalogo.find((t) => t.id === tiendaId);
    tienda.tienda = tiendaId;
    tienda.nombre = tiendaId === 'otra' ? '' : catalogo?.nombre || '';
  }

  get clabeCapturada(): string {
    return soloDigitos(this.mesaRegalos.transferencia.clabe);
  }

  get clabeEsValida(): boolean {
    return clabeValida(this.clabeCapturada);
  }

  get bancoDetectado(): string | null {
    return bancoDesdeClabe(this.clabeCapturada);
  }

  usarBancoDetectado(): void {
    if (this.bancoDetectado) this.mesaRegalos.transferencia.banco = this.bancoDetectado;
  }

  private mesaRegalosLimpia(): MesaRegalos {
    const m = this.mesaRegalos;
    const t = m.transferencia;
    const tiendas = m.tiendas
      .map((x) => ({
        id: x.id,
        tienda: x.tienda,
        nombre: x.nombre.trim(),
        numeroEvento: x.numeroEvento?.trim() || '',
        url: x.url?.trim() || '',
      }))
      .filter((x) => x.nombre && (x.numeroEvento || x.url));

    const transferencia = {
      activa: t.activa,
      titulo: t.titulo?.trim() || '',
      mensaje: t.mensaje?.trim() || '',
      banco: t.banco?.trim() || bancoDesdeClabe(t.clabe) || '',
      titular: t.titular?.trim() || '',
      clabe: soloDigitos(t.clabe),
      cuenta: soloDigitos(t.cuenta),
      tarjeta: soloDigitos(t.tarjeta),
      concepto: t.concepto?.trim() || '',
      whatsappComprobante: soloDigitos(t.whatsappComprobante),
    };
    transferencia.activa = transferencia.activa && !!(transferencia.clabe || transferencia.cuenta || transferencia.tarjeta);

    return {
      activa: m.activa && (tiendas.length > 0 || m.sobres.activo || transferencia.activa),
      mensaje: m.mensaje?.trim() || '',
      tiendas,
      sobres: { activo: m.sobres.activo, texto: m.sobres.texto?.trim() || '' },
      transferencia,
    };
  }

  // ─── Código de vestimenta ─────────────────────────────────────────────────

  /** Cambia el estilo y rellena los textos sugeridos; en "personalizado" conserva lo escrito. */
  elegirEstiloVestimenta(id: string): void {
    const estilo = this.estilosVestimenta.find((e) => e.id === id);
    if (!estilo) return;
    this.dressCode.tipo = id;
    if (id === 'personalizado') return;
    this.dressCode.titulo = estilo.titulo;
    this.dressCode.descripcion = estilo.descripcion;
    this.dressCode.ellas = estilo.ellas;
    this.dressCode.ellos = estilo.ellos;
  }

  aplicarPaleta(paleta: PaletaColores): void {
    this.dressCode.colores = paleta.colores.map((c) => ({ ...c }));
  }

  agregarColorSugerido(): void {
    const hex = this.nuevoColorHex.toLowerCase();
    if (this.dressCode.colores.some((c) => c.hex.toLowerCase() === hex)) return;
    this.dressCode.colores = [...this.dressCode.colores, { hex, nombre: this.nuevoColorNombre.trim() }];
    this.nuevoColorNombre = '';
  }

  quitarColor(lista: 'colores' | 'coloresEvitar', hex: string): void {
    this.dressCode[lista] = this.dressCode[lista].filter((c) => c.hex !== hex);
  }

  alternarColorEvitar(color: ColorSugerido): void {
    const existe = this.dressCode.coloresEvitar.some((c) => c.hex === color.hex);
    this.dressCode.coloresEvitar = existe
      ? this.dressCode.coloresEvitar.filter((c) => c.hex !== color.hex)
      : [...this.dressCode.coloresEvitar, { ...color }];
  }

  colorEvitarActivo(hex: string): boolean {
    return this.dressCode.coloresEvitar.some((c) => c.hex === hex);
  }

  private dressCodeLimpio(): DressCode {
    const d = this.dressCode;
    const limpiarColores = (lista: ColorSugerido[]) =>
      lista.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex)).map((c) => ({ hex: c.hex.toLowerCase(), nombre: c.nombre?.trim() || '' }));
    const titulo = d.titulo?.trim() || '';
    return {
      activo: d.activo && !!titulo,
      tipo: d.tipo,
      titulo,
      descripcion: d.descripcion?.trim() || '',
      ellas: d.ellas?.trim() || '',
      ellos: d.ellos?.trim() || '',
      colores: limpiarColores(d.colores),
      coloresEvitar: limpiarColores(d.coloresEvitar),
      nota: d.nota?.trim() || '',
    };
  }

  // Permite saber en el HTML si debemos mostrar las pestañas de la invitación
  get tieneInvitacionActiva(): boolean {
    return this.eventForm.get('modulos.tieneInvitacion')?.value ?? true;
  }

  /**
   * Carga el catálogo de clientes desde Firestore
   */
  async cargarClientes() {
    this.cargandoClientes = true;
    try {
      this.clientes = await this.clienteService.getClientes();
      const clienteIdActual = this.eventForm.get('clienteId')?.value;
      if (clienteIdActual) {
        this.clienteSeleccionado = this.clientes.find((c) => c.id === clienteIdActual) || null;
      }
    } catch (error) {
      console.error('Error al cargar catálogo de clientes:', error);
    } finally {
      this.cargandoClientes = false;
    }
  }

  /**
   * Se ejecuta al seleccionar un cliente del dropdown
   */
  onClienteChange(clienteId: string | null) {
    if (!clienteId) {
      this.clienteSeleccionado = null;
      this.eventForm.patchValue({
        clienteId: null,
      });
      return;
    }

    const cliente = this.clientes.find((c) => c.id === clienteId);
    if (cliente) {
      this.clienteSeleccionado = cliente;
      this.eventForm.patchValue({
        clienteId: cliente.id,
        contactoNombre: cliente.nombreCompleto,
        contactoTelefono: cliente.telefono || '',
        contactoEmail: cliente.email || '',
        contactoNotas: cliente.notas || '',
        guardarEnCatalogo: false,
      });
    }
  }

  /**
   * Desvincula el cliente seleccionado para capturar uno nuevo libremente
   */
  limpiarClienteSeleccionado() {
    this.clienteSeleccionado = null;
    this.eventForm.patchValue({
      clienteId: null,
      contactoNombre: '',
      contactoTelefono: '',
      contactoEmail: '',
      contactoNotas: '',
      guardarEnCatalogo: true,
    });
  }
}
