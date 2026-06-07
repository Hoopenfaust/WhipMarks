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
          50:  '#FAF5F3',
          100: '#EDE0DC',
          200: '#D8C2BB',
          300: '#C4ADA8',
          400: '#A08C88',
          500: '#7A5E5A',
          600: '#6B5250',
          700: '#534341',
          750: '#44332F',
          800: '#392B28',
          850: '#2E2220',
          900: '#291E1B',
          950: '#201A18',
        },
      },
    },
  },
  plugins: [],
}
