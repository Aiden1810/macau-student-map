import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pine: {
          50: '#eef4ef',
          100: '#dce8df',
          200: '#c1d3c7',
          600: '#326f59',
          700: '#245b49',
          800: '#193d32',
          900: '#183027',
        },
        canvas: '#f8f9f5',
        ink: '#293a31',
        muted: '#6e7872',
        line: '#e2e7e1',
      },
    },
  },
  plugins: [],
};

export default config;
