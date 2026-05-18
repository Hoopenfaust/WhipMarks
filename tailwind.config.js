/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        // Override the full gray scale with neutral (zinc-like) values.
        // Tailwind's default grays have a blue-slate tint (#111827 etc.) which
        // clashes with Claude's neutral dark palette. These match Claude's UI.
        gray: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          750: '#333338',
          800: '#27272a',
          850: '#1f1f22',
          900: '#18181b',
          950: '#0f0f10',
        },
      },
    },
  },
  plugins: [],
}
