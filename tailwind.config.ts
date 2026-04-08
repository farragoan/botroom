import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Debate agent accent colors
        maker: {
          DEFAULT: '#22d3ee',       // cyan-400 — slightly brighter for more pop
          dim: 'rgba(34,211,238,0.07)',
          border: 'rgba(34,211,238,0.2)',
          glow: 'rgba(34,211,238,0.12)',
        },
        checker: {
          DEFAULT: '#e879f9',       // fuchsia-400
          dim: 'rgba(232,121,249,0.07)',
          border: 'rgba(232,121,249,0.2)',
          glow: 'rgba(232,121,249,0.12)',
        },
        // Zinc-based surface system (shadcn-style neutral dark)
        surface: {
          DEFAULT: '#18181b',       // zinc-900
          raised: '#1c1c1f',        // zinc-900 lighter
        },
        // Explicit design tokens
        background: '#09090b',      // zinc-950
        border: '#27272a',          // zinc-800
        muted: {
          DEFAULT: '#27272a',       // zinc-800
          foreground: '#71717a',    // zinc-500
        },
        card: {
          DEFAULT: '#18181b',       // zinc-900
          foreground: '#fafafa',    // zinc-50
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.24)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
        'glow-maker': '0 0 20px rgba(34,211,238,0.1)',
        'glow-checker': '0 0 20px rgba(232,121,249,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-in-left': 'slideInLeft 0.35s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
