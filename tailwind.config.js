/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./views/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        serif: ['serif'],
        script: ['cursive'], // Fallback for signatures
      },
      colors: {
        // Semantic aliases for existing colors
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // emerald-500
          600: '#059669', // emerald-600 (Main Brand)
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        secondary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1', // indigo-500
          600: '#4f46e5', // indigo-600
          700: '#4338ca',
        }
      },
      animation: {
        'in': 'fadeIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
        'zoom-in-95': 'zoomIn95 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        zoomIn95: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      }
    },
  },
  plugins: [],
}