/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080808',
        lime: { DEFAULT: '#B7FF35', dim: 'rgba(183,255,53,0.14)' },
        line: 'rgba(255,255,255,0.08)',
        mute: 'rgba(255,255,255,0.56)',
        faint: 'rgba(255,255,255,0.36)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter"', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '22px' },
    },
  },
  plugins: [],
};
