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
        'bg-app': 'var(--color-bg-app)',
        'bg-panel': 'var(--color-bg-panel)',
        'bg-workspace': 'var(--color-bg-workspace)',
        'border-panel': 'var(--color-border-panel)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted-strong': 'var(--color-text-muted-strong)',
        'grid-main': 'var(--color-grid-main)',
        'grid-sub': 'var(--color-grid-sub)',
        'axis-x': 'var(--color-axis-x)',
        'axis-y': 'var(--color-axis-y)',
        'axis-z': 'var(--color-axis-z)',
        selected: 'var(--color-selected)',
        running: 'var(--color-status-running)',
        pass: 'var(--color-status-executed)',
        blocked: 'var(--color-status-blocked)',
        warning: 'var(--color-status-warning)',
        'command-path': '#0284C7',
        'target-marker': '#38BDF8',
        'status-blocked': 'var(--color-status-blocked)',
        'status-blocked-soft': 'var(--color-status-blocked-soft)',
        'status-blocked-edge': 'var(--color-status-blocked-edge)',
        'status-blocked-surface': 'var(--color-status-blocked-surface)',
        'status-executed': 'var(--color-status-executed)',
        'status-executed-soft': 'var(--color-status-executed-soft)',
        'status-executed-edge': 'var(--color-status-executed-edge)',
        'status-executed-surface': 'var(--color-status-executed-surface)',
        'status-running': 'var(--color-status-running)',
        'status-running-edge': 'var(--color-status-running-edge)',
        'status-warning': 'var(--color-status-warning)',
        'status-warning-edge': 'var(--color-status-warning-edge)',
        'status-warning-surface': 'var(--color-status-warning-surface)'
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
