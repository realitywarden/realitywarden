import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        panel: 'var(--color-panel)',
        'panel-border': 'var(--color-panel-border)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        'console-blue': 'var(--color-console-blue)',
        'pass-green': 'var(--color-pass-green)',
        'blocked-red': 'var(--color-blocked-red)',
        'code-dark': 'var(--color-code-dark)',
        'code-light': 'var(--color-code-light)',
        'bg-app': '#18191B',
        'bg-panel': '#1E1F22',
        'bg-workspace': '#232529',
        'border-panel': '#313338',
        'text-primary': '#DBDEE1',
        'text-secondary': '#949BA4',
        'text-muted-strong': '#5C5E66',
        'grid-main': '#3E4045',
        'grid-sub': '#2B2D31',
        'axis-x': '#E11D48',
        'axis-y': '#059669',
        'axis-z': '#0284C7',
        selected: '#0284C7',
        running: '#F59E0B',
        pass: '#10B981',
        blocked: '#E11D48',
        warning: '#EAB308',
        'command-path': '#0284C7',
        'target-marker': '#38BDF8'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace']
      },
      keyframes: {
        'pulse-border-red': {
          '0%, 100%': { borderColor: 'var(--color-panel-border)' },
          '50%': { borderColor: 'var(--color-blocked-red)' }
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'pulse-error': 'pulse-border-red 1.5s ease-in-out infinite',
        'fade-in-down': 'slide-down 0.3s ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
