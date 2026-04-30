import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#f7f1e7",
        brass: "#b07a1a",
        moss: "#58674d",
        ember: "#b94727",
        clay: "#d8c8b5",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["'Avenir Next'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 50px rgba(17, 17, 17, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
