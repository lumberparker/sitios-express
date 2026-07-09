import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta oficial Sitios Web Express (Adobe Color, 2026-07-09)
        brand: {
          navy: "#224179",
          blue: "#267D9B",
          teal: "#7EB3AB",
          peach: "#FBB476",
          red: "#D94032",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
