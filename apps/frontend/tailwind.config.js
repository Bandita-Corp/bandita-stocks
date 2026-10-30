/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0b0e14',
          panel: '#121620',
          card: '#181d2a',
          border: '#232a3b',
          muted: '#8b95a7',
          up: '#22c55e',
          down: '#ef4444',
          accent: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
