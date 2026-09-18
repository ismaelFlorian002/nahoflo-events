import { Injectable } from '@angular/core';
import type JSZip from 'jszip';

export interface ZipDownloadFile {
  url: string;
  filename: string;
}

export interface ZipDownloadProgress {
  phase: 'downloading' | 'compressing' | 'completed';
  completedFiles: number;
  totalFiles: number;
  currentFilename?: string;
}

export interface ZipDownloadConfig {
  files: readonly ZipDownloadFile[];
  zipFilename: string;
  folderName?: string;
  fetchInit?: RequestInit;
  onProgress?: (progress: ZipDownloadProgress) => void;
}

export interface ZipDownloadResult {
  downloadedFiles: number;
  skippedFiles: number;
  zipFilename: string;
}

type JsZipInstance = JSZip;

@Injectable({
  providedIn: 'root',
})
export class ZipDownloaderService {
  async downloadZip(config: ZipDownloadConfig): Promise<ZipDownloadResult> {
    const zipBlob = await this.createZipBlob(config);
    this.triggerBlobDownload(zipBlob, config.zipFilename);

    return {
      downloadedFiles: config.files.length,
      skippedFiles: 0,
      zipFilename: config.zipFilename,
    };
  }

  async createZipBlob(config: ZipDownloadConfig): Promise<Blob> {
    if (config.files.length === 0) {
      throw new Error('No files were provided to create the ZIP.');
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const targetFolder = this.resolveTargetFolder(zip, config.folderName);

    let completedFiles = 0;

    for (const file of config.files) {
      config.onProgress?.({
        phase: 'downloading',
        completedFiles,
        totalFiles: config.files.length,
        currentFilename: file.filename,
      });

      const blob = await this.fetchFileAsBlob(file.url, config.fetchInit);
      targetFolder.file(file.filename, blob);
      completedFiles += 1;
    }

    config.onProgress?.({
      phase: 'compressing',
      completedFiles,
      totalFiles: config.files.length,
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    config.onProgress?.({
      phase: 'completed',
      completedFiles,
      totalFiles: config.files.length,
    });

    return zipBlob;
  }

  async downloadFile(file: ZipDownloadFile, fetchInit?: RequestInit): Promise<void> {
    const blob = await this.fetchFileAsBlob(file.url, fetchInit);
    this.triggerBlobDownload(blob, file.filename);
  }

  private resolveTargetFolder(zip: JsZipInstance, folderName?: string): JsZipInstance {
    if (!folderName) {
      return zip;
    }

    const folder = zip.folder(folderName);

    if (!folder) {
      throw new Error(`Could not create ZIP folder: ${folderName}`);
    }

    return folder;
  }

  private async fetchFileAsBlob(url: string, fetchInit?: RequestInit): Promise<Blob> {
    const response = await fetch(url, fetchInit);

    if (!response.ok) {
      throw new Error(`Could not download file from ${url}. Status: ${response.status}`);
    }

    return response.blob();
  }

  private triggerBlobDownload(blob: Blob, filename: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
