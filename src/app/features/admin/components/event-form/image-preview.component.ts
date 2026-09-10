import { Component, inject } from '@angular/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-image-preview',
  standalone: true,
  template: `
    <div style="display: flex; justify-content: center; align-items: center; padding: 0.5rem;">
      <img
        [src]="url"
        style="max-width: 100%; max-height: 75vh; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
      />
    </div>
  `,
})
export class ImagePreviewComponent {
  // Atrapamos la URL que le mandaremos desde el servicio
  public config = inject(DynamicDialogConfig);
  url = this.config.data?.url;
}
