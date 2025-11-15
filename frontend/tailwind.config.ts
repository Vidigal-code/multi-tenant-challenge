import type { Config } from 'tailwindcss';
export default <Config>{
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: { extend: {} },
  plugins: []
};
