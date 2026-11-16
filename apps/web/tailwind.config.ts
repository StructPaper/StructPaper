import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#78C841",
        secondary: "#B4E50D",
        warning: "#FF9B2F",
        danger: "#FB4141",
        background: "var(--background)",
        foreground: "var(--foreground)",
        eatzy: {
          primary: "#78C841",
          secondary: "#B4E50D",
          warning: "#FF9B2F",
          danger: "#FB4141",
          dark: "#1A1A1A",
          bg: "#F8F9FA",
        },
      },
      fontFamily: {
        sans: ['"Myriad Pro"', '"Myriad"', '"Source Sans 3"', '"PT Sans"', 'Calibri', 'sans-serif'],
        serif: ['"Minion Pro"', '"Minion"', '"Source Serif 4"', '"Crimson Pro"', '"PT Serif"', '"Times New Roman"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'eatzy-inner': 'inset 0 0 20px rgba(0, 0, 0, 0.09)',
        'eatzy-inner-hover': 'inset 0 0 20px rgba(0, 0, 0, 0.14)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseBorder: {
          '0%, 100%': { borderColor: 'rgba(120, 200, 65, 0.3)' },
          '50%': { borderColor: 'rgba(120, 200, 65, 0.8)' },
        },
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'float-medium': 'float 4s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-border': 'pulseBorder 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
