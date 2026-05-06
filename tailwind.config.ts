import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f7f7f2",
        paper: "#000000",
        accent: "#b0e4cc",
        graphite: "#0b0b0d",
        fog: "#f5f5f0",
      },
      fontFamily: {
        display: [
          "'Helvetica Neue'",
          "Meiryo",
          "'Hiragino Kaku Gothic ProN'",
          "'Yu Gothic'",
          "sans-serif",
        ],
        body: [
          "'Helvetica Neue'",
          "Meiryo",
          "'Hiragino Kaku Gothic ProN'",
          "'Yu Gothic'",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 24px 70px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
} satisfies Config;
