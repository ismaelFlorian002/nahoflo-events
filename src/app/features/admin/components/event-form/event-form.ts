import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog'; // <-- Agregamos DynamicDialogConfig
import { EventService } from '../../../../core/services/eventService';
import { CalendarModule } from 'primeng/calendar';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, CalendarModule],
  templateUrl: './event-form.html',
})
export class EventFormComponent implements OnInit {
  // Inyecciones modernas
  private fb = inject(FormBuilder);
  private eventService = inject(EventService);
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig); // <-- Para recibir los datos del Dashboard

  isEditMode = false;
  eventId?: string;

  // Tu formulario intacto
  eventForm = this.fb.group({
    titulo: ['', Validators.required],
    enlace: ['', Validators.required],
    fecha: ['', Validators.required],
    tipo: ['Boda', Validators.required],
  });

  ngOnInit() {
    // Si config.data trae un evento, significa que le dimos al botón del lapicito
    if (this.config.data) {
      this.isEditMode = true;
      this.eventId = this.config.data.id;

      // Llenamos el formulario con los datos que venían en la tabla
      this.eventForm.patchValue({
        titulo: this.config.data.titulo,
        enlace: this.config.data.enlace,
        fecha: this.config.data.fecha,
        tipo: this.config.data.tipo || 'Boda',
      });
    }
  }

  async saveEvent() {
    if (this.eventForm.valid) {
      try {
        if (this.isEditMode && this.eventId) {
          // MODO EDICIÓN
          await this.eventService.updateEvent(this.eventId, this.eventForm.value);
        } else {
          // MODO CREACIÓN (con tu lógica de estaActivo)
          const newEvent = { ...this.eventForm.value, estaActivo: true };
          await this.eventService.createEvent(newEvent as any);
        }

        // Cerramos el modal avisando que hubo éxito
        this.ref.close(true);
      } catch (error) {
        console.error('Error guardando evento:', error);
      }
    }
  }
}
