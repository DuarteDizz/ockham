/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--secondary-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        ockham: {
          navy: '#0B1020',
          graphite: '#111827',
          slate: '#4B5563',
          muted: '#6B7280',
          mist: '#EDF4F8',
          paper: '#F8FBFD',
          line: '#D7E4EA',
          blue900: '#0838B8',
          blue800: '#0A49C2',
          blue700: '#0868C8',
          cyan600: '#0DA9C2',
          cyan500: '#18C8C4',
          mint400: '#7EDAD0',
          ice300: '#C4ECE8',
          success: '#12B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0, 0, 0, 0.25)',
        panel: '0 24px 64px rgba(5, 11, 28, 0.18)',
        glow: '0 0 22px rgba(24, 200, 196, 0.18)',
        'blue-glow': '0 0 28px rgba(10, 73, 194, 0.22)',
      },
      backgroundImage: {
        'ockham-page': 'radial-gradient(circle at top left, rgba(10,73,194,0.18), transparent 24%), radial-gradient(circle at top right, rgba(24,200,196,0.12), transparent 18%), linear-gradient(180deg, #f7fbfd 0%, #eef5f9 100%)',
        'ockham-button': 'linear-gradient(135deg, #0A49C2 0%, #18C8C4 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
