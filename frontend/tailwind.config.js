/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#f97316",
        ink: "#111111"
      },
      boxShadow: {
        soft: "0 8px 28px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
