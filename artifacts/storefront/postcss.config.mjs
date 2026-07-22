// Tailwind v4 runs as a PostCSS plugin in Next.js (the Vite plugin the rest of
// the workspace uses does not apply here).
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
