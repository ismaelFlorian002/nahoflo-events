/**
 * Roles del sistema B2B2C.
 *
 * - 'admin'  : Acceso total. Ve y edita todos los eventos.
 * - 'partner': Wedding Planner / Agencia. Ve solo sus propios eventos (ownerId).
 *
 * Nota: El rol 'host' (Anfitrión/Novio) NO tiene cuenta Firebase Auth.
 *       Su acceso se gestiona únicamente via PIN estático en el cliente.
 */
export type RolUsuario = 'admin' | 'partner';

export interface UsuarioModel {
  /** ID del documento en Firestore. Debe ser idéntico al Firebase Auth UID. */
  uid: string;

  /** Nombre para mostrar en el panel. */
  displayName: string;

  /** Email asociado a Firebase Auth. */
  email: string;

  /** Rol RBAC del usuario en el sistema. */
  rol: RolUsuario;

  /**
   * Solo relevante si rol === 'partner'.
   * Nombre comercial de la agencia o wedding planner.
   * Se mostrará en la cabecera de su workspace.
   */
  agenciaNombre?: string;

  /**
   * Solo relevante si rol === 'partner'.
   * URL del logo de la agencia para el workspace y marca blanca.
   */
  agenciaLogoUrl?: string;

  /** Teléfono de contacto de la agencia (WhatsApp). */
  agenciaTelefono?: string;

  /** Fecha de creación del usuario en el sistema. */
  creadoEn: Date | string;

  /** Indica si la cuenta está habilitada. El Admin puede desactivar Partners. */
  estaActivo: boolean;
}

/**
 * Perfil resuelto en tiempo de ejecución: combina los datos de Firebase Auth
 * con el documento de Firestore para tener rol + identidad en un solo objeto.
 * Este es el tipo que circula por los servicios y guards de Angular.
 */
export interface PerfilUsuario extends UsuarioModel {
  /**
   * Token de ID de Firebase con custom claims (para validación en Cloud Functions
   * si se escala en el futuro). Por ahora el rol vive en Firestore.
   */
  tokenRefrescado?: boolean;
}
