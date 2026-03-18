import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        card: "var(--card)",
        "card-strong": "var(--card-strong)",
        border: "var(--border)",
        hover: "var(--hover)",
        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          inverse: "var(--text-inverse)",
        },
        priority: {
          critical: "var(--priority-critical)",
          urgent: "var(--priority-urgent)",
          normal: "var(--priority-normal)",
        },
        ai: {
          active: "var(--ai-active)",
          fallback: "var(--ai-fallback)",
          failed: "var(--ai-failed)",
        },
      },
      boxShadow: {
        panel: "var(--shadow-soft)",
        float: "var(--shadow-float)",
      },
      borderRadius: {
        xl: "18px",
        "2xl": "24px",
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
