/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        payit: {
          green: '#10B981',
          'green-hover': '#059669',
          'green-light': 'rgba(16, 185, 129, 0.1)',
          dark: '#090D16',
          card: '#111827',
          surface: '#1F2937',
          border: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 50px -10px rgba(16, 185, 129, 0.25)',
        'card-depth': '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
      },
    },
  },
  plugins: [],
}
