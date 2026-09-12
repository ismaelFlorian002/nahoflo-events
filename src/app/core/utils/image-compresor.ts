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
