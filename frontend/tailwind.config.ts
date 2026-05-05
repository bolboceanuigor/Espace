import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-onest)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: 'hsl(var(--secondary))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: 'hsl(var(--card))',
        'hero-bg': 'var(--hero-bg)',
        'hero-card-bg': 'var(--hero-card-bg)',
        'hero-border': 'var(--hero-border)',
        teal: {
          500: 'var(--teal-500)',
          600: 'var(--teal-600)',
          700: 'var(--teal-700)',
        },
        'reservation-purple': '#A78BFA',
        'reservation-pink': '#F472B6',
        'reservation-green': '#34D399',
        'reservation-orange': '#FB923C',
        'reservation-yellow': '#FCD34D',
        'reservation-blue': '#60A5FA',
        'fresha-bunker': '#0D1619',
        'fresha-azure': '#037AFF',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}
export default config
