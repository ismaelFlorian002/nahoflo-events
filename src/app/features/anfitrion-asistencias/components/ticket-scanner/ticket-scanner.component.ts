import { Component, OnDestroy, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { AudioFeedbackService } from '../../../../core/services/audio-feedback.service';
import {
  QrScannerResult,
  QrScannerService,
} from '../../../../core/services/qr-scanner.service';

@Component({
  selector: 'app-ticket-scanner',
  standalone: true,
  imports: [ButtonModule, CardModule, MessageModule, ProgressSpinnerModule, TagModule, ToolbarModule],
  templateUrl: './ticket-scanner.component.html',
})
export class TicketScannerComponent implements OnDestroy {
  readonly expectedEventId = input<string | null>(null);
  readonly scanValid = output<QrScannerResult>();

  protected readonly qrScanner = inject(QrScannerService);
  private readonly audioFeedback = inject(AudioFeedbackService);

  protected readonly readerElementId = `qr-reader-${crypto.randomUUID()}`;

  protected readonly statusLabel = computed(() => {
    switch (this.qrScanner.status()) {
      case 'starting':
        return 'Iniciando cámara...';
      case 'scanning':
        return 'Cámara activa';
      case 'stopping':
        return 'Apagando cámara...';
      case 'error':
        return 'No se pudo usar la cámara';
      default:
        return 'Cámara apagada';
    }
  });

  protected readonly canToggleScanner = computed(() => {
    const status = this.qrScanner.status();
    return status !== 'starting' && status !== 'stopping';
  });

  protected readonly statusSeverity = computed(() => {
    switch (this.qrScanner.status()) {
      case 'scanning':
        return 'success';
      case 'starting':
      case 'stopping':
        return 'warning';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  });

  async toggleScanner(): Promise<void> {
    await this.qrScanner.toggleScanner(this.readerElementId, (result) => {
      void this.handleValidScan(result);
    });
  }

  async startScanner(): Promise<void> {
    await this.qrScanner.startScanner(this.readerElementId, (result) => {
      void this.handleValidScan(result);
    });
  }

  async stopScanner(): Promise<void> {
    await this.qrScanner.stopScanner();
  }

  ngOnDestroy(): void {
    void this.qrScanner.stopScanner();
  }

  private async handleValidScan(result: QrScannerResult): Promise<void> {
    const eventId = this.expectedEventId();

    if (eventId && result.payload.evId !== eventId) {
      await this.audioFeedback.playErrorSound();
      return;
    }

    await this.audioFeedback.playSuccessSound();
    this.scanValid.emit(result);
  }
}
