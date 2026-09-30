# Revisión visual de la migración PrimeNG

Fecha: 2026-09-30. Versiones instaladas: PrimeNG 22.1.2 y @primeuix/themes 3.0.1.

## Causas verificadas y correcciones

- **Tipografía:** al retirar `primeng/resources/themes/lara-light-indigo/theme.css` no se definió una fuente global. El navegador confirmó Times New Roman en títulos, inputs y botones. Se incorporó Inter variable local (Fontsource 5.3.0, licencia SIL OFL en `public/fonts/LICENSE`) con alternativas del sistema; no requiere Google Fonts.
- **Cascada:** el tema dinámico sobrescribía utilidades de Tailwind. En el acceso, el correo tenía 10 px de padding izquierdo aunque pedía `pl-10` (40 px), superponiendo el icono. El tema ahora ocupa la capa `primeng`, después de `app-base`; las utilidades y estilos locales tienen prioridad.
- **Tailwind incompleto:** se emitían componentes y utilidades, pero no `@tailwind base`. Aunque Preflight esté desactivado, esa directiva inicializa las variables que necesitan sombras, filtros y transformaciones. Se añadió dentro de la capa base junto a un reset mínimo. También se definió el alias `shadow-xs`, utilizado por las plantillas pero ausente en Tailwind 3.
- **Clases antiguas:** los filtros usan Popover pero sus estilos aún apuntaban a OverlayPanel. Se actualizaron clases de Popover, Menu y DatePicker, incluido su panel y el día seleccionado. Se actualizó una variable antigua de superficie en el escáner.
- **Sobrescrituras globales:** se retiró la implementación manual de estados de FloatLabel y la regla que repintaba casi todos los botones en dorado. El tema gestiona estados inválidos, foco, severidades y tamaños. La configuración de campos usa la estructura real del preset instalado, con tokens directos de PrimeUIX 3.

## Validación

- Compilación de producción correcta; permanecen advertencias de dependencias CommonJS de QR, PDF y ZIP.
- `npm run test:portal`: 2 archivos, 10 pruebas aprobadas.
- Acceso comprobado en navegador: Inter cargada, padding del correo de 40 px, variables base de Tailwind presentes y sin desbordamiento horizontal a 390 px.
- No se accedió a pantallas protegidas ni se modificaron datos. Los modales, tablas y portal necesitan revisión visual con una sesión autorizada; la compilación no demuestra que cada pantalla esté visualmente resuelta.

## Pendientes de la migración

- `@angular/animations` instalado en 22.2.0 declara un peer exacto de `@angular/core` 22.2.0, mientras core está en 22.1.5.
- `@angular/fire` 20.0.1 declara peers de Angular ^20.0.0; el proyecto utiliza Angular 22. Revisar versiones compatibles antes de regenerar dependencias. No se forzó la instalación ni se alteró Firebase para corregir el diseño.
- `@primeng/themes` 21.0.4 permanece declarado aunque el tema activo importa `@primeuix/themes`. Conviene retirarlo al normalizar dependencias y actualizar el lockfile de forma conjunta.
- Quedan reglas globales con `!important` en tablas y diálogos. Deben revisarse por pantalla para determinar cuáles expresan el diseño deseado y cuáles conviene convertir a tokens.

Referencias oficiales:
- https://v18.primeng.org/guides/migration
- https://primeng.dev/theming
- https://v18.primeng.org/tailwind

La estructura de tokens se contrastó además con los archivos de Lara y estilos de los componentes realmente instalados en node_modules, porque difiere entre versiones.
