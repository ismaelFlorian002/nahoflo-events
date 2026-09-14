/**
 * Copia un texto al portapapeles de manera confiable en navegadores de escritorio y móviles,
 * soportando contextos seguros (HTTPS) y no seguros (HTTP / IPs de red local).
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  if (!texto) return false;

  // 1. Intento primario: Navigator Clipboard API (HTTPS y localhost)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Puede fallar por falta de permisos o contexto no seguro (HTTP en IP de red local)
    }
  }

  // 2. Fallback de compatibilidad: textarea temporal con document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      // Prevenir scroll y zoom en móviles iOS / Android
      textarea.style.fontSize = '12pt';
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');

      document.body.appendChild(textarea);

      // Selección compatible con iOS y Android
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const exito = document.execCommand('copy');
      document.body.removeChild(textarea);
      return exito;
    } catch (err) {
      console.error('Error al copiar texto con fallback:', err);
      return false;
    }
  }

  return false;
}
