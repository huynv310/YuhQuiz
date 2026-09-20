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
          DEFAULT: '#2563EB', // Trust Blue
          dark: '#1D4ED8',
          light: '#DBEAFE',
        },
        accent: {
          DEFAULT: '#EA580C', // Vibrant Orange
          dark: '#C2410C',
        },
        background: '#F8FAFC',
        surface: '#FFFFFF',
        foreground: '#1E293B',
        muted: '#F1F5F9',
        mutedForeground: '#64748B',
        destructive: '#DC2626',
        success: '#16A34A',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Body font
        heading: ['"Be Vietnam Pro"', 'sans-serif'], // Headings
      }
    },
  },
  plugins: [],
}
