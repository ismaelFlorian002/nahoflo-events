import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PartnerService } from '../../../../core/services/partner.service';
import { UsuarioModel, RolUsuario } from '../../../../core/models/usuario.model';

@Component({
  selector: 'app-partner-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    FloatLabelModule,
  ],
  templateUrl: './partner-modal.component.html',
  styleUrl: './partner-modal.component.scss',
})
export class PartnerModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private partnerService = inject(PartnerService);
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  guardando = false;
  partnerEnEdicion: UsuarioModel | null = null;
  esEdicion = false;

  partnerForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['partner' as RolUsuario, [Validators.required]],
    agenciaNombre: [''],
    agenciaTelefono: ['', [Validators.minLength(7)]],
  });

  ngOnInit() {
    this.configurarValidacionesRol();

    if (this.config.data) {
      this.partnerEnEdicion = this.config.data;
      this.esEdicion = true;

      this.partnerForm.patchValue({
        displayName: this.partnerEnEdicion?.displayName || '',
        email: this.partnerEnEdicion?.email || '',
        rol: this.partnerEnEdicion?.rol || 'partner',
        agenciaNombre: this.partnerEnEdicion?.agenciaNombre || '',
        agenciaTelefono: this.partnerEnEdicion?.agenciaTelefono || '',
      });

      this.partnerForm.get('email')?.disable();
      this.actualizarValidacionAgencia(this.partnerEnEdicion?.rol || 'partner');
    } else {
      this.esEdicion = false;
      this.partnerForm.patchValue({
        password: 'Nahoflo2026*',
        rol: 'partner',
      });
      this.partnerForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.partnerForm.get('password')?.updateValueAndValidity();
      this.actualizarValidacionAgencia('partner');
    }
  }

  setRol(rol: RolUsuario) {
    this.partnerForm.get('rol')?.setValue(rol);
    this.actualizarValidacionAgencia(rol);
  }

  private configurarValidacionesRol() {
    this.partnerForm.get('rol')?.valueChanges.subscribe((rol) => {
      if (rol) {
        this.actualizarValidacionAgencia(rol);
      }
    });
  }

  private actualizarValidacionAgencia(rol: RolUsuario) {
    const agenciaControl = this.partnerForm.get('agenciaNombre');
    if (rol === 'partner') {
      agenciaControl?.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      agenciaControl?.clearValidators();
    }
    agenciaControl?.updateValueAndValidity();
  }

  guardarPartner() {
    if (this.partnerForm.invalid) {
      this.partnerForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor completa todos los campos requeridos correctamente.',
      });
      return;
    }

    const formVal = this.partnerForm.getRawValue();
    const nombre = formVal.displayName?.trim() || '';
    const rol = (formVal.rol as RolUsuario) || 'partner';
    const agencia = rol === 'partner' ? formVal.agenciaNombre?.trim() || '' : 'NahoFlo Studio';

    this.confirmationService.confirm({
      header: this.esEdicion ? 'Confirmar Edición' : 'Confirmar Nuevo Usuario',
      message: this.esEdicion
        ? `¿Deseas guardar los cambios para el usuario "${nombre}" (Rol: ${rol.toUpperCase()})?`
        : `¿Deseas registrar a "${nombre}" con rol ${rol === 'admin' ? 'ADMINISTRADOR' : 'PARTNER'}?`,
      icon: rol === 'admin' ? 'pi pi-shield text-gold-500' : 'pi pi-briefcase text-violet-500',
      acceptLabel: this.esEdicion ? 'Guardar Cambios' : 'Registrar Usuario',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'bg-gold-500 hover:bg-gold-600 text-white border-0',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        await this.ejecutarGuardado(formVal, nombre, rol, agencia);
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelado',
          detail: 'No se realizaron modificaciones.',
        });
      },
    });
  }

  private async ejecutarGuardado(formVal: any, nombre: string, rol: RolUsuario, agencia: string) {
    this.guardando = true;

    try {
      if (this.esEdicion && this.partnerEnEdicion?.uid) {
        await this.partnerService.updateUsuario(this.partnerEnEdicion.uid, {
          displayName: nombre,
          rol: rol,
          agenciaNombre: rol === 'partner' ? agencia : '',
          agenciaTelefono: formVal.agenciaTelefono?.trim() || '',
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Usuario Actualizado',
          detail: `Los datos y permisos de "${nombre}" se actualizaron correctamente.`,
        });
      } else {
        await this.partnerService.createUsuario({
          email: formVal.email?.trim() || '',
          password: formVal.password?.trim() || 'Nahoflo2026*',
          displayName: nombre,
          rol: rol,
          agenciaNombre: rol === 'partner' ? agencia : '',
          agenciaTelefono: formVal.agenciaTelefono?.trim() || '',
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Usuario Creado',
          detail: `"${nombre}" fue registrado como ${rol.toUpperCase()} exitosamente.`,
        });
      }

      this.ref.close(true);
    } catch (error: any) {
      console.error('Error al guardar usuario:', error);
      const codigo = error?.code || '';
      let mensaje = 'Ocurrió un error al guardar el usuario.';

      if (codigo === 'auth/email-already-in-use') {
        mensaje = 'El correo electrónico ya está registrado con otra cuenta.';
      } else if (codigo === 'auth/weak-password') {
        mensaje = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error?.message) {
        mensaje = error.message;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: mensaje,
      });
    } finally {
      this.guardando = false;
    }
  }

  cancelar() {
    this.ref.close(false);
  }
}
