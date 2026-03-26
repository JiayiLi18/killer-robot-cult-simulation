/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: '#0a0a0f',
        'void-light': '#111827',
        'accent-cyan': '#06b6d4',
        'accent-purple': '#8b5cf6',
        'accent-red': '#ef4444',
        surface: '#1a1a2e',
        'surface-light': '#252540',
      },
      fontFamily: {
        mono: ["ui-monospace", "'Cascadia Code'", "'Fira Code'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
}
