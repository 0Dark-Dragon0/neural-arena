/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/dashboard/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Neural Arena Semantic */
        na: {
          sidebar: "hsl(var(--na-sidebar))",
          raised: "hsl(var(--na-surface-raised))",
          sunken: "hsl(var(--na-surface-sunken))",
          success: "hsl(var(--na-success))",
          warning: "hsl(var(--na-warning))",
          info: "hsl(var(--na-info))",
          thinking: "hsl(var(--na-agent-thinking))",
          'board-light': "hsl(var(--na-board-light))",
          'board-dark': "hsl(var(--na-board-dark))",
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xs': ['0.5625rem', { lineHeight: '0.75rem' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'panel': '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
        'panel-hover': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'card': '0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.02)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        'dock': '0 -1px 0 rgba(0,0,0,0.04), 0 -4px 24px rgba(0,0,0,0.03)',
        'sidebar': '1px 0 0 rgba(0,0,0,0.04), 4px 0 16px rgba(0,0,0,0.02)',
        'glow-indigo': '0 0 24px rgba(99,102,241,0.12)',
        'inner-soft': 'inset 0 1px 2px rgba(0,0,0,0.04)',
      },
      animation: {
        'breathe': 'breathe 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
