/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "panel": "#f8fafc",
        "panel-border": "#e2e8f0",
        "ink": "#0f172a",
        "muted": "#64748b",
        "accent": "#0ea5e9",
        "critical": "#dc2626",
        "high": "#f97316",
        "medium": "#eab308",
        "low": "#16a34a"
      }
    }
  },
  plugins: []
};
