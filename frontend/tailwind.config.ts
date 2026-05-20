import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Geist", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      colors: {
        navy: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#a9d5ff",
          300: "#6eb9f2",
          400: "#3998d1",
          500: "#1777b0",
          600: "#0e5c91",
          700: "#0d4773",
          800: "#0b3454",
          900: "#07172b",
          950: "#04101f"
        },
        mint: {
          400: "#31d49b",
          500: "#16a873",
          600: "#0c8259"
        },
        ember: {
          400: "#ffb26b",
          500: "#ff8a3d",
          600: "#e86919"
        }
      },
      boxShadow: {
        panel: "0 24px 80px rgba(7, 23, 43, 0.12)",
        "panel-dark": "0 24px 80px rgba(0, 0, 0, 0.34)"
      }
    }
  },
  plugins: []
} satisfies Config;
