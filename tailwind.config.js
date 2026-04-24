/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef9ee',
          100: '#fdf0d3',
          200: '#fbe0a6',
          300: '#f7c96e',
          400: '#f2ab35',
          500: '#ef9213',
          600: '#e07409',
          700: '#b95609',
          800: '#94420f',
          900: '#79380f',
          950: '#421b04',
        },
        tamale: {
          green: '#2d6a4f',
          brown: '#6d4c41',
          corn: '#f9a825',
          leaf: '#1b5e20',
        }
      },
    },
  },
  plugins: [],
}
