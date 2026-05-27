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
          DEFAULT: '#00BCD4',
          dark: '#0097A7',
        },
        dark: {
          bg: '#121212',
          card: '#1E1E1E',
          hover: '#252525',
        },
        status: {
          success: '#00E676',
          danger: '#F44336',
          warning: '#FF9800',
        }
      }
    },
  },
  plugins: [],
}