import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import type {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeResult,
  QrcodeErrorCallback,
  QrcodeSuccessCallback,
} from 'html5-qrcode';

export interface QrScannerPayload {
  evId: string;
  invId: string;
  slug: string;
}

export interface QrScannerResult {
  decodedText: string;
  payload: QrScannerPayload;
  scannedAt: Date;
}

export type QrScannerStatus = 'idle' | 'starting' | 'scanning' | 'stopping' | 'error';

export type QrScannerErrorCode =
  | 'invalid_payload'
  | 'library_load_failed'
  | 'camera_start_failed'
  | 'camera_stop_failed';

export interface QrScannerError {
  code: QrScannerErrorCode;
  message: string;
  cause?: unknown;
}

type Html5QrcodeConstructor = new (elementId: string) => Html5Qrcode;
type Html5QrcodeModule = typeof import('html5-qrcode');

@Injectable({
  providedIn: 'root',
})
export class QrScannerService implements OnDestroy {
  private readonly statusSignal = signal<QrScannerStatus>('idle');
  private readonly resultSignal = signal<QrScannerResult | null>(null);
  private readonly errorSignal = signal<QrScannerError | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly result = this.resultSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isActive = computed(() => this.statusSignal() === 'scanning');

  private scanner: Html5Qrcode | null = null;
  private scanCallback: ((result: QrScannerResult) => void) | null = null;

  async toggleScanner(elementId: string, onScan?: (result: QrScannerResult) => void): Promise<void> {
    if (this.isActive()) {
      await this.stopScanner();
      return;
    }

    await this.startScanner(elementId, onScan);
  }

  async startScanner(elementId: string, onScan?: (result: QrScannerResult) => void): Promise<void> {
    if (this.statusSignal() === 'starting' || this.statusSignal() === 'scanning') {
      return;
    }

    this.statusSignal.set('starting');
    this.resultSignal.set(null);
    this.errorSignal.set(null);
    this.scanCallback = onScan ?? null;

    try {
      const { Html5Qrcode } = await this.loadHtml5Qrcode();
      await this.waitForElementRender();

      this.scanner = new Html5Qrcode(elementId);
      const onSuccess: QrcodeSuccessCallback = (
        decodedText: string,
        _result: Html5QrcodeResult,
      ) => this.handleDecodedText(decodedText);
      const onError: QrcodeErrorCallback = () => undefined;

      await this.scanner.start(
        { facingMode: 'environment' },
        this.getDefaultScanConfig(),
        onSuccess,
        onError,
      );

      this.statusSignal.set('scanning');
    } catch (cause) {
      this.scanner = null;
      this.statusSignal.set('error');
      this.errorSignal.set({
        code: 'camera_start_failed',
        message: 'No se pudo iniciar la cámara para escanear el código QR.',
        cause,
      });
    }
  }

  async stopScanner(): Promise<void> {
    if (!this.scanner) {
      this.statusSignal.set('idle');
      return;
    }

    this.statusSignal.set('stopping');

    try {
      await this.scanner.stop();
      this.scanner.clear();
      this.scanner = null;
      this.statusSignal.set('idle');
    } catch (cause) {
      this.scanner = null;
      this.statusSignal.set('error');
      this.errorSignal.set({
        code: 'camera_stop_failed',
        message: 'No se pudo detener correctamente la cámara.',
        cause,
      });
    }
  }

  clearResult(): void {
    this.resultSignal.set(null);
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  ngOnDestroy(): void {
    void this.stopScanner();
  }

  private async loadHtml5Qrcode(): Promise<{ Html5Qrcode: Html5QrcodeConstructor }> {
    try {
      const module: Html5QrcodeModule = await import('html5-qrcode');
      return { Html5Qrcode: module.Html5Qrcode };
    } catch (cause) {
      this.errorSignal.set({
        code: 'library_load_failed',
        message: 'No se pudo cargar la librería html5-qrcode.',
        cause,
      });
      throw cause;
    }
  }

  private getDefaultScanConfig(): Html5QrcodeCameraScanConfig {
    return {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    };
  }

  private handleDecodedText(decodedText: string): void {
    const payload = this.parsePayload(decodedText);

    if (!payload) {
      this.errorSignal.set({
        code: 'invalid_payload',
        message: 'El código escaneado no es un pase válido de NahoFlo Events.',
      });
      return;
    }

    const result: QrScannerResult = {
      decodedText,
      payload,
      scannedAt: new Date(),
    };

    this.resultSignal.set(result);
    this.errorSignal.set(null);
    this.scanCallback?.(result);
  }

  private parsePayload(decodedText: string): QrScannerPayload | null {
    try {
      const parsed: unknown = JSON.parse(decodedText);

      if (!this.isQrScannerPayload(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private isQrScannerPayload(value: unknown): value is QrScannerPayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate['evId'] === 'string' &&
      typeof candidate['invId'] === 'string' &&
      typeof candidate['slug'] === 'string'
    );
  }

  private waitForElementRender(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
  }
}
