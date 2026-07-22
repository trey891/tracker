import type { Config } from "tailwindcss";

// Palette mirrors the "Pulse" dark UI: near-black canvas, subtle raised panels,
// indigo/violet brand accent, and the four status hues used across the app.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0b0f",
        panel: "#12141c",
        "panel-2": "#171a24",
        line: "#232734",
        brand: {
          DEFAULT: "#7c5cff",
          soft: "#a48bff",
        },
        status: {
          ontrack: "#22c55e",
          attention: "#f59e0b",
          blocked: "#ef4444",
          done: "#38bdf8",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
