/** @type {import('tailwindcss').Config} */
const withOpacity = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined) return `rgb(var(${variable}))`
  return `rgb(var(${variable}) / ${opacityValue})`
}

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: withOpacity('--color-primary-rgb'),
        'primary-foreground': 'var(--color-primary-foreground)',
        'primary-light': withOpacity('--color-primary-light-rgb'),
      },
    },
  },
  plugins: [],
}
