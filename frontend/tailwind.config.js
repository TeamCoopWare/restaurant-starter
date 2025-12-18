/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{ts,tsx,js,jsx}',
    './src/components/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#9B1D23',
        accent: '#F2C94C',
        forest: '#1E4B3A',
        cream: '#FFF7E6',
        text: '#2E2E2E'
      }
    }
  },
  plugins: []
}
