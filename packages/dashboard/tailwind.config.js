/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#7C3AED",
          600: "#6D28D9",
          700: "#5B21B6",
        },
        solana: {
          green: "#14F195",
          purple: "#9945FF",
        },
      },
    },
  },
  plugins: [],
};
