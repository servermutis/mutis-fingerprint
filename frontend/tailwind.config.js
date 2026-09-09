/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F6F3EC',
          soft: '#FBF9F4',
          dim: '#EDE8DA',
        },
        ink: {
          DEFAULT: '#20302B',
          soft: '#46564F',
          faint: '#7C8B83',
        },
        line: '#DCD5C4',
        gold: {
          DEFAULT: '#B8863B',
          dark: '#93692C',
          soft: '#EADFC7',
        },
        status: {
          hadir: '#3F7256',
          hadirBg: '#E4EEE7',
          telat: '#B8863B',
          telatBg: '#F5EBD8',
          alpha: '#B2503A',
          alphaBg: '#F4E2DC',
          cuti: '#5C6F8C',
          cutiBg: '#E4E8EE',
          libur: '#9A9488',
          liburBg: '#EFEBE3',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
      },
    },
  },
  plugins: [],
};
