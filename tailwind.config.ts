import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-karla)", "system-ui", "sans-serif"],
      },
      colors: {
        // Union — Postify's brand palette (red/green/black/white, tuned
        // off the flag's literal saturation so it reads as a considered
        // brand rather than a national seal). See the identity artifact
        // for the full rationale.
        primary: {
          DEFAULT: "#C1272D",
          dark: "#E14B4B",
        },
        accent: {
          DEFAULT: "#167A46",
          dark: "#3FA36B",
        },
        ink: {
          DEFAULT: "#1A1714",
          soft: "#6b6459",
          dark: "#F2EEE7",
          "soft-dark": "#a89e8d",
        },
        paper: {
          DEFAULT: "#FAF8F5",
          card: "#F0ECE5",
          border: "#e0d7c8",
        },
        night: {
          DEFAULT: "#151210",
          card: "#211C18",
          border: "#332b23",
        },
      },
    },
  },
  plugins: [],
};

export default config;
