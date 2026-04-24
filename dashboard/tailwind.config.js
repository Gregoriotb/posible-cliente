/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      colors: {
        // === Paleta Artificialic (ver sección 1.4 del contexto maestro) ===
        ai: {
          primary: "#22C55E",
          "primary-dark": "#16A34A",
          secondary: "#3B82F6",
          accent: "#8B5CF6",
          bg: "#FFFFFF",
          surface: "#F8FAFC",
          border: "#E2E8F0",
          text: "#0F172A",
          "text-muted": "#64748B",
          danger: "#EF4444",
          warning: "#F59E0B",
          info: "#06B6D4",
        },
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #22C55E 100%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in-right": "slide-in-right 200ms ease-out",
      },
    },
  },
  plugins: [],
};
