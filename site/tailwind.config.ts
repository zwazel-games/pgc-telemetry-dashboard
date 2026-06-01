import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0b0d10",
        surface: "#15181d",
        border:  "#2a2f37",
        text:    "#e6e8eb",
        muted:   "#8a93a0",
        accent:  "#5eead4",
      },
    },
  },
} satisfies Config;
