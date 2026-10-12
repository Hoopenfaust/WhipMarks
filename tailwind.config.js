/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: ['text-indigo-700'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        chiffon: '#a5b4fc', // indigo-300 — replaces old warm accent
        gray: {
          50:  '#F8F7FC',
          100: '#EDEAF7',
          200: '#D6D2E8',
          300: '#B7B2CF',
          400: '#918CAB',
          500: '#5E5980',
          600: '#403C5A',
          700: '#2D2A40',
          750: '#252237',
          800: '#1C1A29',
          850: '#15131F',
          900: '#0F0D17',
          950: '#08070D',
        },
        // The accent: every orange-* class renders violet.
        orange: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
          500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
      },
    },
  },
  plugins: [],
}
