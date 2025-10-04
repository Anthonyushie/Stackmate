/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neo-primary': '#FFE500',
        'neo-secondary': '#FF006E',
        'neo-accent1': '#00F5FF',
        'neo-accent2': '#39FF14',
        'neo-accent3': '#FF6B35',
        'neo-bg': '#F5F5F0',
        'neo-dark': '#000000',
        'neo-white': '#FFFFFF',
        'neo-beginner': '#39FF14',
        'neo-intermediate': '#00F5FF',
        'neo-expert': '#FF006E',
      },
      fontFamily: {
        'heading': ['"Space Grotesk"', 'sans-serif'],
        'body': ['"Inter"', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'brutal-sm': '4px 4px 0px #000000',
        'brutal': '8px 8px 0px #000000',
        'brutal-lg': '12px 12px 0px #000000',
        'brutal-xl': '16px 16px 0px #000000',
        'brutal-pressed': '2px 2px 0px #000000',
      },
      borderWidth: {
        '3': '3px',
        '5': '5px',
        '6': '6px',
        '8': '8px',
      },
      animation: {
        'pulse-brutal': 'pulse-brutal 2s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'pop': 'pop 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-brutal': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-10px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(10px)' },
        },
        'pop': {
          '0%': { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      rotate: {
        '-3': '-3deg',
        '-2': '-2deg',
        '-1': '-1deg',
        '1': '1deg',
        '2': '2deg',
        '3': '3deg',
      },
    },
  },
  plugins: [],
}