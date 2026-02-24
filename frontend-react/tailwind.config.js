/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff7ff",
          100: "#daecff",
          500: "#0f5f92",
          700: "#0a4c73",
          900: "#0c2236"
        }
      },
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};
