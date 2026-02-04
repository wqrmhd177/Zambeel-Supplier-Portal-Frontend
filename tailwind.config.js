/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0e1a',
          card: '#0f1421',
          hover: '#1a1f2e',
        },
        light: {
          bg: '#f3f4f6',
          card: '#ffffff',
          hover: '#e5e7eb',
        },
        'primary-blue': '#4A9FF5',
        'primary-blue-dark': '#3B8DD9',
        'navy': '#0f2744',
        'navy-light': '#1a3a5c',
        'navy-dark': '#0a1c30',
        'sidebar-dark': '#0f0f23',
        'sidebar-indigo': '#1e1b4b',
        'sidebar-purple': '#2d1b69',
        'sidebar-accent': '#f59e0b',
        'sidebar-active-start': '#7c3aed',
        'sidebar-active-end': '#4f46e5',
      },
      boxShadow: {
        '3d-raised': 'inset 1px 1px 0 rgba(255,255,255,0.08), 4px 4px 12px rgba(0,0,0,0.25)',
        '3d-header': 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.2)',
        '3d-button': 'inset 0 -2px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15)',
      },
      animation: {
        'slide-in-left': 'slideInLeft 0.6s ease-out',
        'slide-in-right': 'slideInRight 0.6s ease-out',
      },
      keyframes: {
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

