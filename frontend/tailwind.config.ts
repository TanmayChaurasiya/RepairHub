import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060E1A',
          900: '#0B1729',
          850: '#0F1E35',
          800: '#142745',
          700: '#1F3860',
          600: '#2D4E80',
        },
        brand: {
          orange: '#FF8A3D',
          'orange-hover': '#FA7722',
          cyan: '#22C7DB',
          'cyan-hover': '#1BB5C8',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(11, 23, 41, 0.06), 0 2px 6px -1px rgba(11, 23, 41, 0.04)',
        hover: '0 10px 25px -3px rgba(11, 23, 41, 0.1), 0 4px 10px -2px rgba(11, 23, 41, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
