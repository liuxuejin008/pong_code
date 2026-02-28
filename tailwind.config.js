/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./static/index.html",
    "./static/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308"
        },
        purple: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87"
        },
        sidebar: {
          DEFAULT: "#1a1625",
          light: "#251d35",
          hover: "#2f2542",
          active: "#3d2f57",
          border: "rgba(255,255,255,0.06)"
        },
        surface: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#eeeeee",
          300: "#e0e0e0"
        }
      }
    }
  }
};
