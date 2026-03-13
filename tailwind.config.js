/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tan: {
          50: '#faf7f2',
          100: '#f5f0e8',
          200: '#ebe0d0',
          300: '#d4c4a8',
          400: '#d4a574',
          500: '#c4884a',
          600: '#a06b35',
          700: '#7d5229',
          800: '#4a3118',
          900: '#2c2416',
        },
      },
      fontFamily: {
        karla: ['Karla', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
