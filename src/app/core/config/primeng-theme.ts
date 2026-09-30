import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

/**
 * Preset Corporativo de Diseño para NahoFlo Events (PrimeNG v22)
 * Define los tokens de color primario (Dorado NahoFlo #cca633) y estados interactivos.
 */
export const NahoFloPreset = definePreset(Lara, {
  semantic: {
    typography: {
      fontFamily: 'inherit',
      fontSize: '0.875rem',
      lineHeight: '1.5',
    },
    formField: {
      paddingX: '0.85rem',
      paddingY: '0.65rem',
      borderRadius: '10px',
      hoverBorderColor: '{primary.500}',
      focusBorderColor: '{primary.500}',
    },
    primary: {
      50: '#fdfbf5',
      100: '#f9f3e4',
      200: '#f2e5c3',
      300: '#e8d29b',
      400: '#dcbc6c',
      500: '#cca633', // Dorado NahoFlo Corporativo
      600: '#b89028',
      700: '#947021',
      800: '#785920',
      900: '#644a1e',
      950: '#3a290d',
      color: '{primary.500}',
      contrastColor: '#ffffff',
      hoverColor: '{primary.600}',
      activeColor: '{primary.700}',
    },
  },
  components: {
    floatlabel: {
      root: {
        active: { fontSize: '0.75rem', fontWeight: '600' },
      },
      on: { active: { padding: '0 0.4rem' } },
    },
    button: {
      root: {
        paddingX: '1rem',
        paddingY: '0.5rem',
        borderRadius: '8px',
        sm: { fontSize: '0.8125rem', paddingX: '0.85rem', paddingY: '0.42rem', iconOnlyWidth: '2rem' },
        lg: { fontSize: '1rem', paddingX: '1.25rem', paddingY: '0.65rem', iconOnlyWidth: '2.75rem' },
      },
    },
  },
});
