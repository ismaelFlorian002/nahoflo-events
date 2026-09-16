/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}",
  ],
  corePlugins: {
    preflight: false, // Regla estricta: Preflight desactivado para proteger PrimeNG
  },
  theme: {
    extend: {
      colors: {
        // Paleta Rosa Pastel Premium (Acentos románticos y hovers sutiles)
        'pastel-pink': {
          50: '#fdf6f7',
          100: '#fbe8ec',
          200: '#f8d2db',
          300: '#f2afbf',
          400: '#e8819b',
          500: '#da587a',
          DEFAULT: '#fbe8ec',
        },
        // Paleta Dorado Champán / Corporativo
        'gold': {
          50: '#fbf9f1',
          100: '#f6f1dc',
          200: '#ecdfb4',
          300: '#dfc685',
          400: '#d2ab56',
          500: '#cca633', // Tono dorado existente en el portal
          600: '#a58021',
          700: '#7c5e1b',
          DEFAULT: '#cca633',
        },
      },
    },
  },
  plugins: [],
};
