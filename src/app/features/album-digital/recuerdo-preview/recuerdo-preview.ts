import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { RecuerdoModel } from '../../../core/models/RecuerdoModel';

@Component({
  selector: 'app-recuerdo-preview',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './recuerdo-preview.html',
  styleUrl: './recuerdo-preview.scss',
})
export class RecuerdoPreviewComponent implements OnInit {
  public config = inject(DynamicDialogConfig);
  public ref = inject(DynamicDialogRef);

  recuerdo: RecuerdoModel = this.config.data?.recuerdo;
  fotos: string[] = [];
  indiceActual = signal<number>(0);

  ngOnInit(): void {
    if (this.recuerdo) {
      if (this.recuerdo.fotosUrls && this.recuerdo.fotosUrls.length > 0) {
        this.fotos = this.recuerdo.fotosUrls;
      } else if (this.recuerdo.fotoUrl) {
        this.fotos = [this.recuerdo.fotoUrl];
      }
    }
  }

  cambiarFoto(delta: number): void {
    if (this.fotos.length <= 1) return;
    const nuevo = this.indiceActual() + delta;
    if (nuevo >= 0 && nuevo < this.fotos.length) {
      this.indiceActual.set(nuevo);
    }
  }

  irAFoto(index: number): void {
    if (index >= 0 && index < this.fotos.length) {
      this.indiceActual.set(index);
    }
  }
}
