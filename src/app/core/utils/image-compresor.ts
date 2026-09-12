/**
 * Comprime y redimensiona una imagen en el navegador del cliente
 * usando Canvas nativo (0 dependencias externas).
 * Reduce fotos de 12MB a ~350KB manteniendo calidad HD.
 */
export async function comprimirImagen(
  archivo: File,
  maxDimension = 1600,
  calidad = 0.82,
): Promise<File> {
  // Si no es imagen o es un GIF/SVG (que no se deben rasterizar), devolver tal cual
  if (
    !archivo.type.startsWith('image/') ||
    archivo.type === 'image/gif' ||
    archivo.type === 'image/svg+xml'
  ) {
    return archivo;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;

        // Si ya es más pequeña que el límite y pesa menos de 600KB, no tocarla
        if (ancho <= maxDimension && alto <= maxDimension && archivo.size < 600 * 1024) {
          resolve(archivo);
          return;
        }

        // Redimensionar proporcionalmente manteniendo el aspecto
        if (ancho > alto) {
          if (ancho > maxDimension) {
            alto = Math.round((alto * maxDimension) / ancho);
            ancho = maxDimension;
          }
        } else {
          if (alto > maxDimension) {
            ancho = Math.round((ancho * maxDimension) / alto);
            alto = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(archivo);
          return;
        }

        ctx.drawImage(img, 0, 0, ancho, alto);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(archivo);
              return;
            }

            const nombreBase = archivo.name.replace(/\.[^/.]+$/, '');
            const archivoComprimido = new File([blob], `${nombreBase}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(archivoComprimido);
          },
          'image/jpeg',
          calidad,
        );
      };

      img.onerror = () => resolve(archivo);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(archivo);
    reader.readAsDataURL(archivo);
  });
}

/**
 * Captura la tarjeta HTML exactamente como se muestra en la vista web
 * (con su diseño real, tipografías, íconos y borde dorado, sin los botones de acción)
 * usando html2canvas en alta definición (scale: 3) y dispara la descarga en PNG.
 */
export async function capturarYDescargarTarjetaPaseWeb(
  cardElement: HTMLElement,
  nombreInvitado: string,
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');

  // Asegurar que las fuentes web del navegador estén listas
  if ((document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {}
  }

  // Ocultar botones de acción y controles interactivos antes de capturar
  const botonesOcultar = cardElement.querySelectorAll<HTMLElement>(
    '.vip-pass-actions, .modal-qr-actions, .btn-cerrar-modal, .btn-pases-mini',
  );
  botonesOcultar.forEach((el) => {
    el.style.display = 'none';
  });

  // Guardar estilos temporales para captura limpia sin sombras recortadas
  const prevShadow = cardElement.style.boxShadow;
  const prevAnim = cardElement.style.animation;
  cardElement.style.boxShadow = 'none';
  cardElement.style.animation = 'none';

  try {
    const canvas = await html2canvas(cardElement, {
      scale: 3, // Ultra alta resolución HD
      backgroundColor: null, // Mantiene transparencia en esquinas redondeadas
      useCORS: true,
      logging: false,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const blobUrl = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      const nombreLimpio = nombreInvitado.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
      enlace.download = `Pase_VIP_${nombreLimpio}.png`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }, 'image/png');
  } finally {
    // Restaurar estilos y botones
    cardElement.style.boxShadow = prevShadow;
    cardElement.style.animation = prevAnim;
    botonesOcultar.forEach((el) => {
      el.style.display = '';
    });
  }
}

export interface DatosTarjetaPase {
  tituloEvento: string;
  preTitulo?: string;
  tipo?: string;
  fecha?: string;
  nombreInvitado: string;
  pases: number;
  qrDataUrl: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCornerDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.fillStyle = '#cca633';
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
}

function countWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): number {
  const words = text.split(' ');
  let line = '';
  let count = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      count++;
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  return count + 1;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

/**
 * Genera la tarjeta VIP completa con diseño editorial de lujo
 * en un canvas 2D compacto y perfectamente proporcionado
 * (sin espacios vacíos sobrantes al final).
 */
export async function generarYDescargarTarjetaPase(datos: DatosTarjetaPase): Promise<void> {
  const width = 560;

  // 1. Cargar imagen del QR con anticipación
  let qrImg: HTMLImageElement | null = null;
  if (datos.qrDataUrl) {
    qrImg = new Image();
    qrImg.src = datos.qrDataUrl;
    await new Promise<void>((resolve) => {
      if (qrImg!.complete) {
        resolve();
      } else {
        qrImg!.onload = () => resolve();
        qrImg!.onerror = () => resolve();
      }
    });
  }

  // 2. Medir dimensiones del texto para calcular la altura exacta sin desperdiciar espacio
  const canvas = document.createElement('canvas');
  const tempCtx = canvas.getContext('2d');
  if (!tempCtx) return;

  tempCtx.font = 'bold 26px Georgia, "Times New Roman", serif';
  const titleLines = countWrappedLines(tempCtx, datos.tituloEvento, width - 90);
  const titleLineHeight = 32;
  const titleTotalHeight = titleLines * titleLineHeight;

  tempCtx.font = 'bold 22px Georgia, "Times New Roman", serif';
  const nameLines = countWrappedLines(tempCtx, datos.nombreInvitado, width - 90);
  const nameLineHeight = 28;
  const nameTotalHeight = nameLines * nameLineHeight;

  // 3. Cálculo de altura simétrica exacta
  const padTop = 38;
  const pillH = 30;
  const preTitleH = 22;
  const dateH = datos.fecha ? 22 : 0;
  const perfGap = 16;
  const guestLabelH = 20;
  const pasesBadgeH = 34;
  const qrBoxH = 310;
  const footerH = 64;

  const contentHeight =
    pillH +
    14 +
    preTitleH +
    titleTotalHeight +
    dateH +
    perfGap +
    guestLabelH +
    nameTotalHeight +
    10 +
    pasesBadgeH +
    16 +
    qrBoxH +
    20 +
    footerH;

  const height = Math.round(padTop * 2 + contentHeight);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 4. Fondo general de la tarjeta
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.5, '#fdfcfb');
  bgGrad.addColorStop(1, '#f8f6f0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 5. Marco Dorado Exterior
  ctx.strokeStyle = '#cca633';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 22);
  ctx.stroke();

  // 6. Filete ornamental interior
  ctx.strokeStyle = 'rgba(204, 166, 51, 0.4)';
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 16);
  ctx.stroke();

  // 7. Diamantes en las cuatro esquinas interiores
  drawCornerDiamond(ctx, 36, 36, 3.5);
  drawCornerDiamond(ctx, width - 36, 36, 3.5);
  drawCornerDiamond(ctx, 36, height - 36, 3.5);
  drawCornerDiamond(ctx, width - 36, height - 36, 3.5);

  let curY = padTop;

  // 8. Badge VIP Dorado superior
  const pillW = 210;
  const pillX = (width - pillW) / 2;
  ctx.fillStyle = '#cca633';
  drawRoundedRect(ctx, pillX, curY, pillW, pillH, 15);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ PASE DIGITAL VIP ★', width / 2, curY + pillH / 2);
  curY += pillH + 16;

  // 9. Pre-título (e.g. NUESTRA BODA)
  ctx.textBaseline = 'alphabetic';
  const preTitulo = (datos.preTitulo || datos.tipo || 'Invitación de Honor').toUpperCase();
  ctx.fillStyle = '#a16207';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(preTitulo, width / 2, curY);
  curY += 24;

  // 10. Título principal (e.g. Yesenia & Ismael)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
  curY = drawWrappedText(ctx, datos.tituloEvento, width / 2, curY, width - 90, titleLineHeight);

  // 11. Fecha del evento
  if (datos.fecha) {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(datos.fecha, width / 2, curY + 2);
    curY += 22;
  }

  // 12. Troquelado de boleto clásico
  const perfY = curY + 10;
  // Muesca izquierda
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(16, perfY, 12, -Math.PI / 2, Math.PI / 2, false);
  ctx.fill();
  ctx.strokeStyle = '#cca633';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Muesca derecha
  ctx.beginPath();
  ctx.arc(width - 16, perfY, 12, Math.PI / 2, -Math.PI / 2, false);
  ctx.fill();
  ctx.stroke();

  // Línea de puntos
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.moveTo(34, perfY);
  ctx.lineTo(width - 34, perfY);
  ctx.stroke();
  ctx.setLineDash([]);

  curY = perfY + 28;

  // 13. Datos del Invitado
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INVITADO(S) DE HONOR', width / 2, curY);
  curY += 24;

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
  curY = drawWrappedText(ctx, datos.nombreInvitado, width / 2, curY, width - 90, nameLineHeight);

  // 14. Píldora de pases
  const pasesTexto = `Acceso para: ${datos.pases} ${datos.pases === 1 ? 'persona' : 'personas'}`;
  const pasesBadgeW = 230;
  const pasesBadgeX = (width - pasesBadgeW) / 2;
  ctx.fillStyle = '#f1f5f9';
  drawRoundedRect(ctx, pasesBadgeX, curY, pasesBadgeW, pasesBadgeH, 17);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(pasesTexto, width / 2, curY + pasesBadgeH / 2 + 5);
  curY += pasesBadgeH + 16;

  // 15. Caja del Código QR
  const qrBoxW = 310;
  const qrBoxX = (width - qrBoxW) / 2;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, curY, qrBoxW, qrBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (qrImg) {
    const qrSize = 230;
    const qrX = (width - qrSize) / 2;
    const qrY = curY + 16;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // Texto dentro de la caja QR
  ctx.fillStyle = '#64748b';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Presenta este código en la entrada del salón', width / 2, curY + 280);
  curY += qrBoxH + 20;

  // 16. Footer de seguridad y marca
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• Pase personal e intransferible •', width / 2, curY);
  curY += 16;

  // Línea divisoria dorada con diamante
  ctx.strokeStyle = '#cca633';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 80, curY);
  ctx.lineTo(width / 2 - 8, curY);
  ctx.moveTo(width / 2 + 8, curY);
  ctx.lineTo(width / 2 + 80, curY);
  ctx.stroke();
  drawCornerDiamond(ctx, width / 2, curY, 3);
  curY += 18;

  ctx.fillStyle = '#a16207';
  ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('NAHOFLO EVENTS · EXPERIENCIA DIGITAL VIP', width / 2, curY);

  // 17. Disparar la descarga del archivo PNG
  canvas.toBlob((blob) => {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = blobUrl;
    const nombreLimpio = datos.nombreInvitado.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
    enlace.download = `Pase_VIP_${nombreLimpio}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }, 'image/png');
}
