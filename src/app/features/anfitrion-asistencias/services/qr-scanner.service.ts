import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Servicio encargado de la orquestación del escáner de códigos QR mediante la cámara.
 * Implementa Lazy Loading de 'html5-qrcode' para no penalizar el peso inicial de la aplicación
 * y garantiza la liberación adecuada de los recursos de hardware (cámara) al destruirse.
 */
@Injectable({
  providedIn: 'root',
})
export class QrScannerService {
  private destroyRef = inject(DestroyRef);
  private html5QrCodeInstance: any = null;

  readonly escanerActivo = signal<boolean>(false);
  readonly inicializando = signal<boolean>(false);

  constructor() {
    // Garantiza que la cámara se apague si el usuario navega fuera del módulo
    this.destroyRef.onDestroy(() => {
      this.detenerEscaner();
    });
  }

  /**
   * Alterna el estado del escáner de cámara.
   */
  async toggleEscaner(
    elementId: string,
    onScanSuccess: (decodedText: string) => void,
  ): Promise<void> {
    if (this.escanerActivo()) {
      await this.detenerEscaner();
    } else {
      await this.iniciarEscaner(elementId, onScanSuccess);
    }
  }

  /**
   * Inicia el escáner de cámara en el contenedor especificado por su ID.
   * Utiliza la cámara trasera (environment) y un marco optimizado de 250x250.
   */
  async iniciarEscaner(
    elementId: string,
    onScanSuccess: (decodedText: string) => void,
    onScanError?: (error: any) => void,
  ): Promise<void> {
    if (this.escanerActivo() || this.inicializando()) return;

    this.inicializando.set(true);

    try {
      // Lazy loading de html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      // Si existía una instancia previa sin limpiar, la liberamos
      if (this.html5QrCodeInstance) {
        await this.detenerEscaner();
      }

      this.html5QrCodeInstance = new Html5Qrcode(elementId);

      await this.html5QrCodeInstance.start(
        { facingMode: 'environment' }, // Cámara trasera del dispositivo
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          onScanSuccess(decodedText);
        },
        (errorMessage: string) => {
          if (onScanError) {
            onScanError(errorMessage);
          }
        },
      );

      this.escanerActivo.set(true);
    } catch (error) {
      console.error('Error al inicializar la cámara con Html5Qrcode:', error);
      this.escanerActivo.set(false);
      this.html5QrCodeInstance = null;
    } finally {
      this.inicializando.set(false);
    }
  }

  /**
   * Detiene el flujo de video de la cámara y limpia el contenedor HTML.
   */
  async detenerEscaner(): Promise<void> {
    if (this.html5QrCodeInstance) {
      try {
        if (this.html5QrCodeInstance.isScanning) {
          await this.html5QrCodeInstance.stop();
        }
        await this.html5QrCodeInstance.clear();
      } catch (error) {
        console.error('Error al detener cámara:', error);
      } finally {
        this.html5QrCodeInstance = null;
      }
    }
    this.escanerActivo.set(false);
  }
}
